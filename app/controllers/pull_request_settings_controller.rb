# frozen_string_literal: true

# Project settings » Pull requests: the repositories allowed in the project
class PullRequestSettingsController < ApplicationController
  menu_item :settings

  before_action :find_project_by_project_id
  before_action :authorize

  def update
    @pull_request_setting = PullRequestProjectSetting.for(@project)
    @pull_request_setting.repositories = params[:repositories].to_s
    if @pull_request_setting.save
      flash[:notice] = l(:notice_successful_update)
      redirect_to settings_project_path(@project, tab: 'pull_requests')
    else
      render action: 'edit', status: :unprocessable_entity
    end
  end
end
