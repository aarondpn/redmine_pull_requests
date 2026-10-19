# frozen_string_literal: true

module RedminePullRequests
  module ProjectPatch
    def self.included(base)
      base.class_eval do
        has_one :pull_request_project_setting, dependent: :delete
      end
    end
  end
end
