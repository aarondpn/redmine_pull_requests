# frozen_string_literal: true

# Per-project settings of the plugin: the repositories whose pull requests
# may be linked to issues of the project (see RedminePullRequests::RepositoryPatterns)
# Redmine 5 has no ApplicationRecord
class PullRequestProjectSetting < (defined?(ApplicationRecord) ? ApplicationRecord : ActiveRecord::Base)
  include Redmine::I18n

  belongs_to :project

  validates :project_id, presence: true, uniqueness: true
  validates :repositories, length: { maximum: 20_000 }
  validate :validate_repository_patterns

  def self.for(project)
    find_or_initialize_by(project_id: project.id)
  end

  # Ids of the given projects that allow the repository
  def self.allowed_project_ids(project_ids, provider, repository)
    where(project_id: project_ids).select { |setting| setting.allows?(provider, repository) }.map(&:project_id)
  end

  def self.allows?(project, provider, repository)
    allowed_project_ids([project.id], provider, repository).any?
  end

  def self.repositories_configured?(project)
    find_by(project_id: project.id)&.repository_patterns&.empty? == false
  end

  def repositories=(text)
    super(text.to_s.gsub("\r\n", "\n").strip)
  end

  def repository_patterns
    @repository_patterns = nil unless @repository_patterns&.text == repositories
    @repository_patterns ||= RedminePullRequests::RepositoryPatterns.new(repositories)
  end

  def allows?(provider, repository)
    repository_patterns.allows?(provider, repository)
  end

  private

  def validate_repository_patterns
    repository_patterns.errors.each do |line, pattern|
      errors.add(:base, l(:error_pull_request_invalid_repository_pattern, line: line, pattern: pattern))
    end
  end
end
