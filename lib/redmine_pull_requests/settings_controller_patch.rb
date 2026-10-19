# frozen_string_literal: true

module RedminePullRequests
  # Access tokens and webhook secrets are not rendered into the plugin
  # settings form. A blank field keeps the stored value, the "Remove"
  # checkbox (clear_pull_request_settings[]) clears it.
  module SettingsControllerPatch
    def self.included(base)
      base.before_action :keep_pull_request_secrets, only: :plugin
    end

    private

    def keep_pull_request_secrets
      return unless request.post? && params[:id] == 'redmine_pull_requests'
      return unless params[:settings].is_a?(ActionController::Parameters)

      cleared = Array(params[:clear_pull_request_settings])
      stored = Setting.plugin_redmine_pull_requests
      SECRET_SETTINGS.each do |name|
        next if params[:settings][name].present?

        params[:settings][name] = cleared.include?(name) ? '' : stored[name].to_s
      end
    end
  end
end
