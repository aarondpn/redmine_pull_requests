# frozen_string_literal: true

module RedminePullRequests
  class GitlabClient < Client
    # "locked" is a short state while a merge is in progress
    STATES = { 'opened' => 'open', 'merged' => 'merged', 'closed' => 'closed', 'locked' => 'open' }.freeze
    # Merge request hook actions that (re)link referenced issues ("update"
    # only when the title, description or draft status changed, see .webhook_event)
    LINK_ACTIONS = %w(open reopen update).freeze
    LINK_CHANGES = %w(title description draft work_in_progress).freeze
    # Events that change comments or pipelines of known merge requests
    DETAIL_EVENTS = ['Note Hook', 'Pipeline Hook'].freeze

    PIPELINE_STATES = { 'success' => 'success', 'failed' => 'failure', 'canceled' => 'neutral' }.freeze
    REVIEWER_STATES = { 'approved' => 'approved', 'requested_changes' => 'changes_requested',
                        'reviewed' => 'commented' }.freeze

    def self.provider
      'gitlab'
    end

    # "/acme/platform/web/-/merge_requests/7/diffs" => ["acme/platform/web", 7]
    def self.parse_path(path)
      if (m = path.match(%r{\A/((?:[\w.-]+/)+?[\w.-]+)(?:/-)?/merge_requests/(\d+)(?:/|\z)}))
        [m[1], m[2].to_i]
      end
    end

    # Maps a REST API merge request object to PullRequest attributes
    def self.attributes(data)
      {
        url: data['web_url'],
        title: data['title'],
        state: STATES.fetch(data['state'], 'open'),
        draft: !!(data['draft'] || data['work_in_progress']),
        author_login: data.dig('author', 'username'),
        author_avatar_url: avatar_url(data.dig('author', 'avatar_url')),
        merged_by_login: (data['merge_user'] || data['merged_by'])&.dig('username'),
        head_ref: data['source_branch'],
        base_ref: data['target_branch'],
        changed_files: data['changes_count']&.to_i,
        opened_at: data['created_at'],
        merged_at: data['merged_at'],
        closed_at: data['closed_at'],
        head_sha: data['sha'],
        comments_count: data['user_notes_count'],
        synced_at: Time.now
      }.merge(pipeline_attributes(data['head_pipeline']))
    end

    # GitLab has one pipeline instead of individual checks
    def self.pipeline_attributes(pipeline)
      return { checks_state: nil, checks_url: nil } unless pipeline

      state = PIPELINE_STATES.fetch(pipeline['status'], pipeline['status'] == 'skipped' ? nil : 'pending')
      { checks_state: state, checks_url: pipeline['web_url'], checks_count: nil,
        checks_passed_count: nil, checks_failed_count: nil }
    end

    # Merge requests affected by a comment or pipeline event
    def self.affected_pull_requests(event, payload)
      return PullRequest.none unless DETAIL_EVENTS.include?(event)

      repository = payload.dig('project', 'path_with_namespace')
      raise InvalidPayload, 'invalid project' unless RedminePullRequests.valid_repository?(provider, repository)

      scope = PullRequest.in_repository(provider, repository)
      affected = scope.where(number: [payload.dig('merge_request', 'iid')].grep(Integer))
      sha = payload.dig('object_attributes', 'sha') if event == 'Pipeline Hook'
      affected = affected.or(scope.where(head_sha: sha)) if sha.is_a?(String) && sha.size <= 64
      affected
    rescue TypeError
      raise InvalidPayload, 'invalid payload'
    end

    # "Merge Request Hook" payload => WebhookEvent. The payload has less details
    # than the API (no author name, no commit count), so only known attributes
    # are set and the rest is loaded from the API if a token is configured.
    def self.webhook_event(payload)
      data = payload['object_attributes']
      return unless payload['object_kind'] == 'merge_request' && data.is_a?(Hash)

      repository = payload.dig('project', 'path_with_namespace')
      validate_reference!(repository, data['iid'])
      action = data['action']
      user = payload['user'].is_a?(Hash) ? payload['user'] : {}
      state = STATES.fetch(data['state'], 'open')
      attributes = {
        url: data['url'],
        title: data['title'],
        state: state,
        draft: !!(data['draft'] || data['work_in_progress']),
        head_ref: data['source_branch'],
        base_ref: data['target_branch'],
        opened_at: data['created_at'],
        synced_at: Time.now
      }
      attributes.merge!(author_login: user['username'], author_avatar_url: avatar_url(user['avatar_url'])) if action == 'open'
      attributes[:merged_by_login] = user['username'] if action == 'merge'
      attributes[:merged_at] = data['merged_at'] || data['updated_at'] if state == 'merged'
      attributes[:closed_at] = data['closed_at'] || data['updated_at'] if state == 'closed'

      WebhookEvent.new(
        provider: provider,
        repository: repository,
        number: data['iid'],
        attributes: attributes,
        title: data['title'].to_s,
        body: data['description'].to_s,
        branch: data['source_branch'].to_s,
        link: LINK_ACTIONS.include?(action) && (action != 'update' || link_update?(payload)),
        merge: action == 'merge' && state == 'merged',
        refresh: true
      )
    rescue TypeError
      raise InvalidPayload, 'invalid merge request'
    end

    # GitLab sends "update" for any change (labels, assignees, pushes, ...),
    # only edits of the title, description or draft status link issues
    def self.link_update?(payload)
      changes = payload['changes']
      data = payload['object_attributes']
      changes.is_a?(Hash) && data['oldrev'].blank? && (LINK_CHANGES & changes.keys).any?
    end

    # Self-hosted instances return avatar paths relative to the GitLab URL
    def self.avatar_url(url)
      return if url.blank?

      url.start_with?('/') ? RedminePullRequests.web_url(provider).chomp('/') + url : url
    end

    # Loads the merge request with commits, reviewers and discussions. Parts
    # that fail to load are left out, so their previous values are kept.
    def fetch(repository, number)
      path = "/projects/#{ERB::Util.url_encode(repository)}/merge_requests/#{number.to_i}"
      data, = get(path)
      attributes = self.class.attributes(data)
      attributes[:repository] = canonical_repository(repository, data.dig('references', 'full').to_s.sub(/!\d+\z/, ''))
      attributes.merge!(optional { { commits_count: commits_count(path) } })
      attributes.merge!(optional { reviews(path, data) })
      attributes.merge!(optional { { unresolved_threads_count: unresolved_threads(path) } })
      attributes
    end

    private

    def commits_count(path)
      commits, response = get("#{path}/commits?per_page=100")
      response['X-Total'].presence&.to_i || commits.size
    end

    def reviews(path, data)
      reviewers = {}
      Array(data['reviewers']).each do |user|
        reviewers[user['username']] = reviewer(user, 'pending')
      end
      # Reviewer states (GitLab 16+), not available on older versions
      begin
        states, = get("#{path}/reviewers")
        states.each do |entry|
          reviewers[entry.dig('user', 'username')] = reviewer(entry['user'], REVIEWER_STATES.fetch(entry['state'], 'pending'))
        end
      rescue Error
        nil
      end
      approvals, = get("#{path}/approvals")
      Array(approvals['approved_by']).each do |entry|
        reviewers[entry.dig('user', 'username')] = reviewer(entry['user'], 'approved')
      end

      list = ReviewSummary.reviewers(reviewers.values)
      { reviewers: list, review_decision: ReviewSummary.decision(list, approvals_missing: approvals['approvals_left']) }
    end

    def reviewer(user, state)
      { 'login' => user['username'], 'avatar_url' => self.class.avatar_url(user['avatar_url']), 'state' => state }
    end

    def unresolved_threads(path)
      get_list("#{path}/discussions").count do |discussion|
        notes = Array(discussion['notes'])
        notes.any? { |note| note['resolvable'] } && notes.none? { |note| note['resolved'] }
      end
    end

    def authorize(request)
      request['PRIVATE-TOKEN'] = @token
    end
  end
end
