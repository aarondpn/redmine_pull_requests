# frozen_string_literal: true

module RedminePullRequests
  # Reloads a pull request from the API after a webhook delivery, so the
  # webhook can answer right away. Deliveries come in bursts (one per check
  # run), so jobs start with a short delay: the first job of a burst claims
  # the refresh and the jobs of deliveries that arrived before it are skipped.
  class RefreshJob < ActiveJob::Base
    queue_as :default

    DELAY = 3 # seconds

    # Enqueues a refresh for each pull request whose provider has a token
    # (without a token, details are only reloaded with the Refresh button).
    # Returns the pull requests that were queued.
    def self.enqueue(pull_requests)
      requested_at = Time.now.to_f
      pull_requests.select do |pull_request|
        next false unless RedminePullRequests.token(pull_request.provider)

        set(wait: DELAY).perform_later(pull_request.id, requested_at)
        true
      end
    end

    # The database connection is only held while reading and writing, not
    # during the API requests, which can take seconds (the async adapter runs
    # jobs in threads that share Redmine's connection pool).
    def perform(pull_request_id, requested_at)
      pull_request, previous = with_connection { claim(pull_request_id, Time.at(requested_at)) }
      return unless pull_request

      begin
        attributes = RedminePullRequests.client(pull_request.provider).fetch(pull_request.repository, pull_request.number)
        with_connection do
          pull_request.reload.assign_attributes(attributes)
          pull_request.save!
        end
      rescue Client::Error, ActiveRecord::RecordInvalid => e
        with_connection { PullRequest.where(id: pull_request.id).update_all(synced_at: previous) }
        Rails.logger.warn("[redmine_pull_requests] Could not refresh #{pull_request.reference}: #{e.message}")
      end
    end

    private

    # Claims the refresh: jobs for deliveries before this point are skipped.
    # Returns the pull request and its previous synced_at, or nil.
    def claim(pull_request_id, requested_at)
      Setting.check_cache
      pull_request = PullRequest.find_by(id: pull_request_id)
      return unless pull_request && RedminePullRequests.token(pull_request.provider)

      previous = pull_request.synced_at
      claimed = PullRequest.where(id: pull_request.id).
        where('synced_at IS NULL OR synced_at < ?', requested_at).
        update_all(synced_at: Time.now)
      [pull_request, previous] unless claimed.zero?
    end

    def with_connection(&block)
      ActiveRecord::Base.connection_pool.with_connection(&block)
    end
  end
end
