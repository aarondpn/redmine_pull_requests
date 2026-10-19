# frozen_string_literal: true

module RedminePullRequests
  module IssuePatch
    def self.included(base)
      base.class_eval do
        has_many :issue_pull_requests, dependent: :delete_all
        has_many :pull_requests, -> { sorted }, through: :issue_pull_requests
      end
    end
  end
end
