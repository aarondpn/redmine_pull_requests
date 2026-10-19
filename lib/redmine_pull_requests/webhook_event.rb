# frozen_string_literal: true

module RedminePullRequests
  # A pull/merge request event, normalized from a GitHub or GitLab webhook payload.
  #   attributes - PullRequest attributes taken from the payload
  #   link       - whether referenced issues should be (re)linked
  #   merge      - whether this is the merge event (applies fixing keywords)
  #   refresh    - whether to load missing details from the API afterwards
  WebhookEvent = Struct.new(:provider, :repository, :number, :attributes, :title, :body, :branch,
                            :link, :merge, :refresh, keyword_init: true)
end
