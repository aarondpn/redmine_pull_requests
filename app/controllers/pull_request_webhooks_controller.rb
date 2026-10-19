# frozen_string_literal: true

# Receives GitHub and GitLab webhooks.
#
# GitHub: content type "application/json", the secret is verified with the
# X-Hub-Signature-256 HMAC. Events: pull requests, plus pull request reviews,
# review comments, review threads, issue comments, check runs/suites and
# statuses to keep reviews and checks up to date.
# GitLab: the secret token is sent in X-Gitlab-Token. Triggers: merge request
# events, plus comments and pipeline events.
#
# Review, comment and checks events only queue a refresh of the affected pull
# requests (RedminePullRequests::RefreshJob), so deliveries are answered fast.
class PullRequestWebhooksController < ActionController::Base
  skip_forgery_protection

  # Not an ApplicationController: reload settings changed by other processes
  # (e.g. a rotated secret)
  before_action { Setting.check_cache }
  before_action :require_secret
  before_action :verify_github_signature, only: :github
  before_action :verify_gitlab_token, only: :gitlab

  def github
    case request.headers['X-GitHub-Event']
    when 'ping'
      render json: { status: 'ok' }
    when 'pull_request'
      process_event RedminePullRequests::GithubClient.webhook_event(payload)
    else
      refresh_pull_requests RedminePullRequests::GithubClient.affected_pull_requests(request.headers['X-GitHub-Event'], payload)
    end
  end

  def gitlab
    if request.headers['X-Gitlab-Event'] == 'Merge Request Hook'
      process_event RedminePullRequests::GitlabClient.webhook_event(payload)
    else
      refresh_pull_requests RedminePullRequests::GitlabClient.affected_pull_requests(request.headers['X-Gitlab-Event'], payload)
    end
  end

  rescue_from JSON::ParserError do
    render json: { error: 'invalid JSON payload' }, status: :bad_request
  end

  rescue_from RedminePullRequests::InvalidPayload do |e|
    render json: { error: e.message }, status: 422
  end

  rescue_from ActiveRecord::RecordInvalid do |e|
    render json: { error: e.record.errors.full_messages.to_sentence }, status: 422
  end

  private

  def provider
    action_name
  end

  def payload
    @payload ||= JSON.parse(request.raw_post).tap do |payload|
      raise JSON::ParserError, 'not an object' unless payload.is_a?(Hash)
    end
  end

  def process_event(event)
    processor = RedminePullRequests::WebhookProcessor.new(event)
    processed = processor.process
    render json: {
      status: processed ? 'processed' : 'ignored',
      pull_request: processor.pull_request&.reference,
      linked_issues: processor.linked_issues.map(&:id),
      fixed_issues: processor.fixed_issues.map(&:id)
    }
  end

  def refresh_pull_requests(scope)
    queued = RedminePullRequests::RefreshJob.enqueue(scope.to_a)
    render json: { status: queued.any? ? 'queued' : 'ignored', pull_requests: queued.map(&:reference) }
  end

  def secret
    RedminePullRequests.webhook_secret(provider)
  end

  def require_secret
    render json: { error: 'webhook secret is not configured' }, status: :forbidden if secret.blank?
  end

  def verify_github_signature
    expected = 'sha256=' + OpenSSL::HMAC.hexdigest('SHA256', secret, request.raw_post)
    render_unauthorized unless ActiveSupport::SecurityUtils.secure_compare(expected, request.headers['X-Hub-Signature-256'].to_s)
  end

  def verify_gitlab_token
    render_unauthorized unless ActiveSupport::SecurityUtils.secure_compare(secret, request.headers['X-Gitlab-Token'].to_s)
  end

  def render_unauthorized
    render json: { error: 'invalid signature' }, status: :unauthorized
  end
end
