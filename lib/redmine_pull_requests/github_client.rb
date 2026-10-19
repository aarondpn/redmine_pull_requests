# frozen_string_literal: true

module RedminePullRequests
  class GithubClient < Client
    # Actions that (re)link referenced issues. Other actions only update the
    # state, so links removed manually do not come back on every push.
    LINK_ACTIONS = %w(opened edited reopened ready_for_review).freeze
    ACTIONS = LINK_ACTIONS + %w(closed synchronize converted_to_draft review_requested review_request_removed)
    # Events that change reviews, comments or checks of known pull requests
    DETAIL_EVENTS = %w(pull_request_review pull_request_review_comment pull_request_review_thread
                       issue_comment check_run check_suite status).freeze

    CHECK_FAILURES = %w(failure timed_out cancelled action_required startup_failure stale error).freeze

    REVIEW_STATES = { 'APPROVED' => 'approved', 'CHANGES_REQUESTED' => 'changes_requested',
                      'COMMENTED' => 'commented', 'DISMISSED' => 'dismissed' }.freeze

    UNRESOLVED_THREADS_QUERY = <<~GRAPHQL
      query($owner: String!, $name: String!, $number: Int!, $cursor: String) {
        repository(owner: $owner, name: $name) {
          pullRequest(number: $number) {
            reviewThreads(first: 100, after: $cursor) {
              nodes { isResolved }
              pageInfo { hasNextPage endCursor }
            }
          }
        }
      }
    GRAPHQL

    def self.provider
      'github'
    end

    # "/acme/web/pull/42/files" => ["acme/web", 42]
    def self.parse_path(path)
      if (m = path.match(%r{\A/([\w.-]+/[\w.-]+)/pulls?/(\d+)(?:/|\z)}))
        [m[1], m[2].to_i]
      end
    end

    # Maps a REST API / webhook pull request object to PullRequest attributes
    def self.attributes(data)
      merged = data['merged'] || data['merged_at'].present?
      {
        url: data['html_url'],
        title: data['title'],
        state: merged ? 'merged' : data['state'],
        draft: !!data['draft'],
        author_login: data.dig('user', 'login'),
        author_avatar_url: data.dig('user', 'avatar_url'),
        merged_by_login: data.dig('merged_by', 'login'),
        head_ref: data.dig('head', 'ref'),
        base_ref: data.dig('base', 'ref'),
        additions: data['additions'],
        deletions: data['deletions'],
        changed_files: data['changed_files'],
        commits_count: data['commits'],
        opened_at: data['created_at'],
        merged_at: data['merged_at'],
        closed_at: data['closed_at'],
        head_sha: data.dig('head', 'sha'),
        synced_at: Time.now
      }.tap do |attributes|
        # only part of the full pull request object, not of list responses
        attributes[:comments_count] = data['comments'].to_i + data['review_comments'].to_i if data.key?('comments')
      end
    end

    # Webhook "pull_request" event payload => WebhookEvent
    def self.webhook_event(payload)
      data = payload['pull_request']
      return unless data.is_a?(Hash) && ACTIONS.include?(payload['action'])

      repository = payload.dig('repository', 'full_name') || data.dig('base', 'repo', 'full_name')
      validate_reference!(repository, data['number'])
      attrs = attributes(data)
      WebhookEvent.new(
        provider: provider,
        repository: repository,
        number: data['number'],
        attributes: attrs,
        title: data['title'].to_s,
        body: data['body'].to_s,
        branch: data.dig('head', 'ref').to_s,
        link: LINK_ACTIONS.include?(payload['action']),
        merge: payload['action'] == 'closed' && attrs[:state] == 'merged',
        refresh: true
      )
    rescue TypeError
      raise InvalidPayload, 'invalid pull_request'
    end

    # Pull requests affected by a review, comment or checks event
    def self.affected_pull_requests(event, payload)
      return PullRequest.none unless DETAIL_EVENTS.include?(event)

      repository = payload.dig('repository', 'full_name')
      raise InvalidPayload, 'invalid repository' unless RedminePullRequests.valid_repository?(provider, repository)

      scope = PullRequest.in_repository(provider, repository)
      numbers = [payload.dig('pull_request', 'number')]
      numbers << payload.dig('issue', 'number') if payload.dig('issue', 'pull_request')
      %w(check_run check_suite).each do |key|
        numbers.concat(Array(payload.dig(key, 'pull_requests')).map { |pr| pr['number'] if pr.is_a?(Hash) })
      end
      shas = [payload['sha'], payload.dig('check_run', 'head_sha'), payload.dig('check_suite', 'head_sha')]

      affected = scope.where(number: numbers.grep(Integer))
      shas = shas.grep(String).select { |sha| sha.size <= 64 }
      affected = affected.or(scope.where(head_sha: shas)) if shas.any?
      affected
    rescue TypeError
      raise InvalidPayload, 'invalid payload'
    end

    # Loads the pull request with its reviews, checks and review threads. Parts
    # that fail to load are left out, so their previous values are kept.
    def fetch(repository, number)
      path = "/repos/#{repository}/pulls/#{number.to_i}"
      data, = get(path)
      attributes = self.class.attributes(data)
      attributes[:repository] = canonical_repository(repository, data.dig('base', 'repo', 'full_name'))
      attributes.merge!(optional { reviews(path, data) })
      attributes.merge!(optional { checks(repository, data) })
      attributes.merge!(optional { { unresolved_threads_count: unresolved_threads(repository, number) } }) if @token
      attributes
    end

    private

    def reviews(path, data)
      latest = {}
      # oldest first, so later reviews replace earlier ones
      get_list("#{path}/reviews").each do |review|
        login = review.dig('user', 'login')
        state = REVIEW_STATES[review['state']]
        next unless login && state
        # a comment does not replace an earlier approval or change request
        next if state == 'commented' && latest[login] && latest[login]['state'] != 'commented'

        # a dismissed review withdraws the reviewer's earlier opinion
        state = 'commented' if state == 'dismissed'
        latest[login] = { 'login' => login, 'avatar_url' => review.dig('user', 'avatar_url'), 'state' => state }
      end
      # re-requested reviewers are pending again
      Array(data['requested_reviewers']).each do |user|
        latest[user['login']] = { 'login' => user['login'], 'avatar_url' => user['avatar_url'], 'state' => 'pending' }
      end
      Array(data['requested_teams']).each do |team|
        latest[team['slug']] = { 'login' => team['name'] || team['slug'], 'avatar_url' => nil, 'state' => 'pending' }
      end
      list = ReviewSummary.reviewers(latest.values)
      { reviewers: list, review_decision: ReviewSummary.decision(list) }
    end

    def checks(repository, data)
      sha = data.dig('head', 'sha')
      return {} if sha.blank?

      # Fine-grained tokens can't read check runs, commit statuses still count then
      runs = optional_list { get_list("/repos/#{repository}/commits/#{sha}/check-runs", key: 'check_runs') }
      statuses = optional_list { get_list("/repos/#{repository}/commits/#{sha}/status", key: 'statuses') }
      raise Error, 'neither check runs nor commit statuses could be loaded' if runs.nil? && statuses.nil?

      results = Array(runs).map do |run|
        if run['status'] != 'completed' then :pending
        elsif CHECK_FAILURES.include?(run['conclusion']) then :failure
        else :success
        end
      end
      results += Array(statuses).map do |status|
        { 'success' => :success, 'pending' => :pending }.fetch(status['state'], :failure)
      end
      ReviewSummary.checks(results, url: "#{data['html_url']}/checks")
    end

    # Review threads are only available through the GraphQL API (needs a token).
    # GraphQL errors come with status 200, they keep the previous count.
    def unresolved_threads(repository, number)
      owner, name = repository.split('/', 2)
      variables = { owner: owner, name: name, number: number.to_i, cursor: nil }
      count = 0
      MAX_PAGES.times do
        data = post(graphql_url, query: UNRESOLVED_THREADS_QUERY, variables: variables)
        raise Error, 'invalid GraphQL response' unless data.is_a?(Hash)

        threads = data.dig('data', 'repository', 'pullRequest', 'reviewThreads')
        if data['errors'].present? || !threads.is_a?(Hash) || !threads['nodes'].is_a?(Array)
          raise Error, Array(data['errors']).filter_map { |e| e['message'] if e.is_a?(Hash) }.first || 'no review threads'
        end

        count += threads['nodes'].count { |thread| !thread['isResolved'] }
        break unless threads.dig('pageInfo', 'hasNextPage')

        variables[:cursor] = threads.dig('pageInfo', 'endCursor')
      end
      count
    end

    # https://api.github.com/graphql, https://github.example.com/api/graphql
    def graphql_url
      @api_url.end_with?('/api/v3') ? @api_url.delete_suffix('/v3') + '/graphql' : "#{@api_url}/graphql"
    end

    def authorize(request)
      request['Authorization'] = "Bearer #{@token}"
      request['Accept'] = 'application/vnd.github+json'
      request['X-GitHub-Api-Version'] = '2022-11-28'
    end
  end
end
