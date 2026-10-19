# frozen_string_literal: true

class PullRequestsController < ApplicationController
  before_action :find_issue
  before_action :authorize
  before_action :find_pull_request, only: [:show, :destroy, :refresh]

  accept_api_auth :index, :show, :create, :destroy, :refresh

  helper :pull_requests

  def index
    @links = @issue.issue_pull_requests.joins(:pull_request).merge(PullRequest.sorted).includes(:pull_request, :user)
    respond_to do |format|
      format.api
    end
  end

  def show
    @link = @issue.issue_pull_requests.find_by!(pull_request_id: @pull_request.id)
    respond_to do |format|
      format.api
    end
  end

  # URLs accepted per request
  MAX_URLS = 20

  # Links one or more pull/merge requests (URLs separated by whitespace or
  # commas, pasting several lines into the text field joins them without
  # separator). Only repositories allowed in the project settings can be
  # linked. The API links (and stores) nothing if one of the URLs fails.
  def create
    @errors = []
    urls = requested_urls
    pull_requests = []
    if urls.size > MAX_URLS
      @errors << l(:error_pull_request_too_many_urls, count: MAX_URLS)
    elsif urls.any? && !PullRequestProjectSetting.repositories_configured?(@project)
      @errors << l(:error_pull_request_no_repositories_allowed)
    else
      pull_requests = load_pull_requests(urls)
      @errors << l(:error_pull_request_url_blank) if pull_requests.empty? && @errors.empty?
    end

    unless api_request? && @errors.any?
      pull_requests = pull_requests.filter_map { |pull_request| save_pull_request(pull_request) }
      pull_requests.each { |pull_request| pull_request.link_issue(@issue, user: User.current) }
    end

    respond_to do |format|
      format.api do
        if @errors.any?
          render_api_errors(@errors)
        else
          @links = @issue.issue_pull_requests.where(pull_request_id: pull_requests.map(&:id)).
            joins(:pull_request).merge(PullRequest.sorted).includes(:pull_request, :user)
          render action: 'index', status: :created
        end
      end
      respond_to_panel(format)
    end
  end

  def refresh
    @errors = []
    load_details(@pull_request) && save_pull_request(@pull_request)
    respond_to do |format|
      format.api do
        if @errors.any?
          render_api_errors(@errors)
        else
          @link = @issue.issue_pull_requests.find_by!(pull_request_id: @pull_request.id)
          render action: 'show'
        end
      end
      respond_to_panel(format)
    end
  end

  # Unlinks the pull request from the issue. The pull request record is kept,
  # so webhook deliveries for it do not link the issue again.
  def destroy
    @issue.issue_pull_requests.find_by!(pull_request_id: @pull_request.id).destroy!
    respond_to do |format|
      format.api { render_api_ok }
      respond_to_panel(format)
    end
  end

  private

  # Like ApplicationController#find_issue: 404 for unknown issues, 401/403
  # for issues the user can't see
  def find_issue
    @issue = Issue.find(params[:issue_id])
    raise ::Unauthorized unless @issue.visible?

    @project = @issue.project
  rescue ActiveRecord::RecordNotFound
    render_404
  end

  def find_pull_request
    @pull_request = @issue.pull_requests.find(params[:id])
  rescue ActiveRecord::RecordNotFound
    render_404
  end

  # url=... from the form, {"pull_request": {"url": ...}} or
  # {"pull_request": {"urls": [...]}} from the API
  def requested_urls
    attributes = params[:pull_request].is_a?(ActionController::Parameters) ? params[:pull_request] : {}
    urls = attributes[:urls].is_a?(Array) ? attributes[:urls] : [attributes[:urls]]
    values = [params[:url], attributes[:url], *urls].grep(String)
    values.flat_map { |value| value.split(/[\s,]+|(?=https?:\/\/)/) }.compact_blank.uniq
  end

  # Returns the pull requests that could be loaded (not saved yet), collects
  # errors for the others
  def load_pull_requests(urls)
    urls.filter_map do |url|
      provider, repository, number = RedminePullRequests.parse_url(url)
      unless provider
        @errors << l(:error_pull_request_invalid_url, url: url)
        next
      end
      unless PullRequestProjectSetting.allows?(@project, provider, repository)
        @errors << l(:error_pull_request_repository_not_allowed, repository: repository)
        next
      end

      pull_request = PullRequest.find_or_initialize_by_reference(provider, repository, number)
      pull_request if load_details(pull_request)
    end.uniq
  end

  def load_details(pull_request)
    pull_request.fetch_details
    pull_request.validate!
    true
  rescue RedminePullRequests::Client::Error, ActiveRecord::RecordInvalid => e
    add_fetch_error(pull_request, e.message)
    false
  end

  # Saves a loaded pull request, returns nil if that fails
  def save_pull_request(pull_request)
    save_or_merge(pull_request)
  rescue ActiveRecord::RecordInvalid => e
    add_fetch_error(pull_request, e.message)
    nil
  end

  # If a webhook created the pull request in the meantime, the loaded
  # details are saved to that record instead
  def save_or_merge(pull_request)
    pull_request.save!
    pull_request
  rescue ActiveRecord::RecordNotUnique, ActiveRecord::RecordInvalid => e
    raise unless pull_request.new_record? && PullRequest.duplicate_error?(e)

    existing = PullRequest.find_or_initialize_by_reference(pull_request.provider, pull_request.repository, pull_request.number)
    existing.assign_attributes(pull_request.attributes.except('id', 'created_at', 'updated_at').compact)
    existing.save!
    existing
  end

  def add_fetch_error(pull_request, message)
    @errors << l(:error_pull_request_fetch_failed, reference: pull_request.reference,
                                                   provider: pull_request.provider_name, message: message)
  end

  def respond_to_panel(format)
    format.html do
      # Redmine renders flash messages as HTML
      flash[:error] = @errors.map { |error| ERB::Util.html_escape(error) }.join(', ') if @errors.present?
      redirect_to issue_path(@issue)
    end
    # Errors of a failed refresh are shown without opening the link form
    format.js { render 'update', locals: { show_form: action_name == 'create' } }
  end
end
