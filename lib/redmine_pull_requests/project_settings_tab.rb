# frozen_string_literal: true

module RedminePullRequests
  # Adds the "Pull requests" tab to the project settings
  module ProjectSettingsTab
    def project_settings_tabs
      tabs = super
      if User.current.allowed_to?(:manage_pull_request_settings, @project)
        tabs << { name: 'pull_requests', action: :manage_pull_request_settings,
                  partial: 'pull_request_settings/project_settings', label: :label_pull_request_plural }
      end
      tabs
    end
  end
end
