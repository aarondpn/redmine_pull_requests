# frozen_string_literal: true

Redmine::Plugin.register :redmine_pull_requests do
  name 'Pull Requests'
  author 'Aaron Döppner'
  description 'Link GitHub pull requests and GitLab merge requests to Redmine issues and keep their state in sync.'
  version '1.0.0'
  url 'https://github.com/aarondpn/redmine_pull_requests'
  requires_redmine version_or_higher: '5.0.0'

  settings partial: 'settings/pull_requests_settings',
           default: {
             'github_web_url' => 'https://github.com',
             'github_api_url' => 'https://api.github.com',
             'github_token' => '',
             'github_webhook_secret' => '',
             'gitlab_web_url' => 'https://gitlab.com',
             'gitlab_api_url' => 'https://gitlab.com/api/v4',
             'gitlab_token' => '',
             'gitlab_webhook_secret' => '',
             'link_bare_refs' => '1',
             'link_branch_refs' => '1',
             'apply_fix_keywords' => '1'
           }

  project_module :pull_requests do
    permission :view_pull_requests, { pull_requests: [:index, :show] }, read: true
    permission :manage_pull_requests, { pull_requests: [:create, :destroy, :refresh] }
    permission :manage_pull_request_settings, { projects: :settings, pull_request_settings: :update }, require: :member
  end
end

# Keeps tokens and webhook secrets out of the logs
secret_filter = /\A(?:#{RedminePullRequests::SECRET_SETTINGS.join('|')})\z/
filters = Rails.application.config.filter_parameters
filters << secret_filter unless filters.include?(secret_filter)

Issue.include RedminePullRequests::IssuePatch unless Issue.included_modules.include?(RedminePullRequests::IssuePatch)
Project.include RedminePullRequests::ProjectPatch unless Project.included_modules.include?(RedminePullRequests::ProjectPatch)
unless SettingsController.included_modules.include?(RedminePullRequests::SettingsControllerPatch)
  SettingsController.include RedminePullRequests::SettingsControllerPatch
end
RedminePullRequests::Hooks # registers the view hooks
IssuesController.helper PullRequestsHelper
ProjectsController.helper RedminePullRequests::ProjectSettingsTab
