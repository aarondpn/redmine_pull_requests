# frozen_string_literal: true

module RedminePullRequests
  # Handles a pull/merge request WebhookEvent: keeps linked pull requests up to
  # date, links newly referenced issues and applies fixing keywords on merge.
  # Only issues of projects that allow the repository are linked or fixed.
  class WebhookProcessor
    include Redmine::I18n

    # References processed per event, the rest is ignored
    MAX_REFERENCES = 50

    attr_reader :pull_request, :linked_issues, :fixed_issues

    def initialize(event)
      @event = event
      @linked_issues = []
      @fixed_issues = []
    end

    # Concurrent deliveries for a new pull request (e.g. "opened" and
    # "review_requested") may both try to create it, the second one is
    # retried with the record of the first.
    def process
      return false unless @event

      attempts = 0
      begin
        process_event
      rescue ActiveRecord::RecordNotUnique, ActiveRecord::RecordInvalid => e
        attempts += 1
        retry if attempts == 1 && PullRequest.duplicate_error?(e)
        raise
      end
    end

    private

    def process_event
      @linked_issues = []
      @fixed_issues = []
      @pull_request = PullRequest.find_or_initialize_by_reference(@event.provider, @event.repository, @event.number)
      @pull_request.assign_attributes(@event.attributes)
      # the name as used by GitHub/GitLab, a manual link may differ in case
      @pull_request.repository = @event.repository

      refs = ReferenceParser.new.parse(title: @event.title, body: @event.body, branch: @event.branch).
        first(MAX_REFERENCES).to_h
      issues = referenced_issues(refs.keys)
      return false if @pull_request.new_record? && issues.empty?

      PullRequest.transaction do
        link = @pull_request.new_record? || @event.link
        @pull_request.save!
        if link
          issues.each do |issue|
            @linked_issues << issue if @pull_request.link_issue(issue, source: 'webhook')
          end
        end
      end

      apply_fixes(issues, refs) if @event.merge && @pull_request.merged?
      # Loads details missing in the payload (reviews, checks, ...)
      RefreshJob.enqueue([@pull_request]) if @event.refresh
      true
    end

    # Fixing keywords are applied once, on the first delivery of the merge
    # event, no matter what other events or refreshes saw before
    def apply_fixes(issues, refs)
      claimed = PullRequest.where(id: @pull_request.id, merge_fixes_applied_at: nil).
        update_all(merge_fixes_applied_at: Time.now)
      return if claimed.zero? || !RedminePullRequests.setting?('apply_fix_keywords')

      linked_ids = @pull_request.issue_pull_requests.pluck(:issue_id)
      issues.select { |issue| linked_ids.include?(issue.id) }.each do |issue|
        keyword = refs[issue.id]
        @fixed_issues << issue if keyword && fix_issue(issue, keyword)
      end
    end

    # Issues of active projects with the module enabled that allow the
    # repository (Project settings » Pull requests)
    def referenced_issues(ids)
      return [] if ids.empty?

      issues = Issue.joins(:project).where(id: ids).
        where(projects: { status: Project::STATUS_ACTIVE }).
        where(project_id: EnabledModule.where(name: 'pull_requests').select(:project_id)).to_a
      allowed = PullRequestProjectSetting.allowed_project_ids(issues.map(&:project_id).uniq, @event.provider, @event.repository)
      issues.select { |issue| allowed.include?(issue.project_id) }
    end

    # Mirrors Changeset#fix_issue: applies the matching rule of the
    # "Fixing keywords" repository setting
    def fix_issue(issue, keyword)
      issue.reload
      return false if issue.closed?

      rule = Setting.commit_update_keywords_array.detect do |r|
        r['keywords'].include?(keyword) &&
          (r['if_tracker_id'].blank? || r['if_tracker_id'] == issue.tracker_id.to_s)
      end
      return false unless rule

      issue.init_journal(User.anonymous,
                         ll(Setting.default_language, :"text_status_changed_by_#{@pull_request.kind}", @pull_request.reference))
      issue.assign_attributes rule.slice(*Issue.attribute_names)
      return false unless issue.changes.any?

      issue.save.tap do |saved|
        Rails.logger.warn("Issue ##{issue.id} could not be saved by #{@pull_request.reference}: #{issue.errors.full_messages}") unless saved
      end
    end
  end
end
