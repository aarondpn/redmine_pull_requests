# frozen_string_literal: true

# Redmine 5 has no ApplicationRecord
class IssuePullRequest < (defined?(ApplicationRecord) ? ApplicationRecord : ActiveRecord::Base)
  belongs_to :issue
  belongs_to :pull_request
  belongs_to :user, optional: true

  validates :source, inclusion: { in: %w(manual webhook) }
  validates :pull_request_id, uniqueness: { scope: :issue_id }
end
