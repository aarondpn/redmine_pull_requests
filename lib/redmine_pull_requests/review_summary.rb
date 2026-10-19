# frozen_string_literal: true

module RedminePullRequests
  # Provider independent helpers to build the review and checks attributes
  module ReviewSummary
    module_function

    # Sorts reviewers like GitHub: blocking reviews first, pending reviews last
    def reviewers(list)
      list.uniq { |r| r['login'] }.sort_by do |r|
        [PullRequest::REVIEWER_STATES.index(r['state']) || 99, r['login'].to_s.downcase]
      end
    end

    def decision(reviewers, approvals_missing: nil)
      states = reviewers.pluck('state')
      if states.include?('changes_requested')
        'changes_requested'
      elsif approvals_missing.to_i.positive? || (approvals_missing.nil? && states.include?('pending') && !states.include?('approved'))
        'review_required'
      elsif states.include?('approved')
        'approved'
      end
    end

    # results: list of :success, :failure or :pending
    def checks(results, url:)
      return { checks_state: nil, checks_count: 0, checks_passed_count: 0, checks_failed_count: 0, checks_url: url } if results.empty?

      failed = results.count(:failure)
      passed = results.count(:success)
      state = if failed.positive? then 'failure'
              elsif passed < results.size then 'pending'
              else 'success'
              end
      { checks_state: state, checks_count: results.size, checks_passed_count: passed,
        checks_failed_count: failed, checks_url: url }
    end
  end
end
