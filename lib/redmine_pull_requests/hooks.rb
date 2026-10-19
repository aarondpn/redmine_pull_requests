# frozen_string_literal: true

module RedminePullRequests
  class Hooks < Redmine::Hook::ViewListener
    render_on :view_issues_show_description_bottom, partial: 'pull_requests/hook'
  end
end
