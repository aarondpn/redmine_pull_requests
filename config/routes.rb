# frozen_string_literal: true

resources :issues, only: [] do
  resources :pull_requests, only: [:index, :show, :create, :destroy] do
    post :refresh, on: :member
  end
end

patch 'projects/:project_id/pull_request_settings', to: 'pull_request_settings#update', as: 'project_pull_request_settings'

post 'pull_requests/github/webhook', to: 'pull_request_webhooks#github', as: 'github_pull_request_webhook'
post 'pull_requests/gitlab/webhook', to: 'pull_request_webhooks#gitlab', as: 'gitlab_pull_request_webhook'
