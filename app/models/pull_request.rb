# frozen_string_literal: true

# A GitHub pull request or GitLab merge request
# Redmine 5 has no ApplicationRecord
class PullRequest < (defined?(ApplicationRecord) ? ApplicationRecord : ActiveRecord::Base)
  STATUSES = %w(open draft merged closed).freeze
  REVIEWER_STATES = %w(changes_requested approved commented pending).freeze

  # [{"login" => "octocat", "avatar_url" => "...", "state" => "approved"}, ...]
  if ActiveRecord.version >= Gem::Version.new('7.1')
    serialize :reviewers, coder: JSON
  else # Redmine 5 (Rails 6.1)
    serialize :reviewers, JSON
  end

  has_many :issue_pull_requests, dependent: :delete_all
  has_many :issues, through: :issue_pull_requests

  validates :provider, inclusion: { in: RedminePullRequests::PROVIDERS }
  validates :repository, :number, :url, presence: true
  validates :state, inclusion: { in: %w(open closed merged) }
  validates :url, format: { with: %r{\Ahttps?://}i }
  validate :validate_repository, :validate_unique_reference

  # A merged pull request stays merged, even if a delayed webhook delivery
  # or a lagging API response says otherwise
  before_save do
    if state_changed? && state_was == 'merged'
      self.state = 'merged'
      %w(merged_at merged_by_login closed_at).each do |attribute|
        self[attribute] = attribute_was(attribute) if self[attribute].blank?
      end
    end
  end

  # Open PRs first, then most recently opened
  scope :sorted, lambda {
    order(Arel.sql("CASE state WHEN 'open' THEN 0 WHEN 'merged' THEN 1 ELSE 2 END"), opened_at: :desc, id: :desc)
  }

  # Repository names are case-insensitive on GitHub and GitLab
  scope :in_repository, lambda { |provider, repository|
    where(provider: provider).where('LOWER(repository) = ?', repository.to_s.downcase)
  }

  def self.find_or_initialize_by_reference(provider, repository, number)
    find_by(provider: provider, repository: repository, number: number) ||
      in_repository(provider, repository).find_by(number: number) ||
      new(provider: provider, repository: repository, number: number)
  end

  # Loads the details from the GitHub or GitLab API without saving them
  def fetch_details
    assign_attributes(RedminePullRequests.client(provider).fetch(repository, number))
  end

  # Reloads the details from the GitHub or GitLab API
  def refresh!
    fetch_details
    save!
  end

  def status
    state == 'open' && draft? ? 'draft' : state
  end

  def merged?
    state == 'merged'
  end

  def open?
    state == 'open'
  end

  def gitlab?
    provider == 'gitlab'
  end

  # "pull_request" or "merge_request"
  def kind
    gitlab? ? 'merge_request' : 'pull_request'
  end

  def provider_name
    gitlab? ? 'GitLab' : 'GitHub'
  end

  # "#42" on GitHub, "!42" on GitLab
  def display_number
    "#{gitlab? ? '!' : '#'}#{number}"
  end

  def reference
    "#{repository}#{display_number}"
  end

  def repository_url
    url.sub(%r{(?:/-)?/(?:pulls?|merge_requests)/\d+.*\z}, '')
  end

  def diff_stats?
    additions.present? && deletions.present?
  end

  def reviewers
    Array(super)
  end

  def checks_pending_count
    return unless checks_count

    checks_count - checks_passed_count.to_i - checks_failed_count.to_i
  end

  def review_details?
    reviewers.any? || review_decision.present? || checks_state.present? ||
      comments_count.to_i.positive? || unresolved_threads_count.to_i.positive?
  end

  # Links the pull request to +issue+, returns the link or nil if it already
  # existed (also if another request linked it at the same time)
  def link_issue(issue, user: nil, source: 'manual')
    return if issue_pull_requests.exists?(issue_id: issue.id)

    IssuePullRequest.transaction(requires_new: true) do
      issue_pull_requests.create!(issue: issue, user: user, source: source)
    end
  rescue ActiveRecord::RecordNotUnique
    nil
  end

  # True if saving failed because another request created the same pull
  # request in the meantime
  def self.duplicate_error?(error)
    error.is_a?(ActiveRecord::RecordNotUnique) ||
      (error.is_a?(ActiveRecord::RecordInvalid) && error.record.is_a?(PullRequest) && error.record.errors.added?(:number, :taken))
  end

  private

  def validate_repository
    return if repository.blank? || !RedminePullRequests::PROVIDERS.include?(provider)

    errors.add(:repository, :invalid) unless RedminePullRequests.valid_repository?(provider, repository)
  end

  def validate_unique_reference
    return if repository.blank? || number.blank?
    return unless new_record? || will_save_change_to_repository? || will_save_change_to_number? || will_save_change_to_provider?

    duplicate = PullRequest.in_repository(provider, repository).where(number: number)
    duplicate = duplicate.where.not(id: id) if persisted?
    errors.add(:number, :taken) if duplicate.exists?
  end
end
