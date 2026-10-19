# frozen_string_literal: true

module RedminePullRequests
  PROVIDERS = %w(github gitlab).freeze

  DEFAULT_URLS = {
    'github' => { web: 'https://github.com', api: 'https://api.github.com' },
    'gitlab' => { web: 'https://gitlab.com', api: 'https://gitlab.com/api/v4' }
  }.freeze

  # Plugin settings that hold credentials: not rendered into the settings
  # form and filtered from the logs
  SECRET_SETTINGS = %w(github_token github_webhook_secret gitlab_token gitlab_webhook_secret).freeze

  # "owner/repo" on GitHub, "group/subgroup/project" on GitLab
  REPOSITORY_FORMATS = {
    'github' => %r{\A[\w.-]+/[\w.-]+\z},
    'gitlab' => %r{\A[\w.-]+(?:/[\w.-]+)+\z}
  }.freeze

  # Invalid or unexpected webhook payload
  class InvalidPayload < StandardError; end

  def self.settings
    Setting.plugin_redmine_pull_requests
  end

  def self.setting?(name)
    settings[name].to_s == '1'
  end

  def self.client_class(provider)
    { 'github' => GithubClient, 'gitlab' => GitlabClient }.fetch(provider.to_s)
  end

  def self.client(provider)
    client_class(provider).new
  end

  def self.api_url(provider)
    settings["#{provider}_api_url"].presence || DEFAULT_URLS.fetch(provider)[:api]
  end

  def self.web_url(provider)
    settings["#{provider}_web_url"].presence || DEFAULT_URLS.fetch(provider)[:web]
  end

  # Access token, e.g. from REDMINE_PR_GITLAB_TOKEN or the plugin settings
  def self.token(provider)
    ENV["REDMINE_PR_#{provider.upcase}_TOKEN"].presence || settings["#{provider}_token"].presence
  end

  def self.webhook_secret(provider)
    ENV["REDMINE_PR_#{provider.upcase}_WEBHOOK_SECRET"].presence || settings["#{provider}_webhook_secret"].presence
  end

  def self.valid_repository?(provider, repository)
    repository.is_a?(String) && REPOSITORY_FORMATS.fetch(provider).match?(repository) &&
      repository.split('/').none? { |segment| segment.match?(/\A\.+\z/) }
  end

  # Hosts and path prefixes accepted in URLs: the public host plus a
  # self-hosted one from the settings, which may use a relative URL root
  # (https://example.com/gitlab => ["example.com", "/gitlab"])
  def self.web_roots(provider)
    [DEFAULT_URLS.fetch(provider)[:web], web_url(provider)].filter_map do |url|
      uri = URI.parse(url)
      [uri.host.downcase, uri.path.to_s.chomp('/')] if uri.host
    rescue URI::InvalidURIError
      nil
    end.uniq
  end

  def self.hosts(provider)
    web_roots(provider).map(&:first).uniq
  end

  # Returns [provider, repository, number] for a pull/merge request URL or nil
  #   https://github.com/acme/web/pull/42                    => ["github", "acme/web", 42]
  #   https://gitlab.com/acme/platform/web/-/merge_requests/7 => ["gitlab", "acme/platform/web", 7]
  def self.parse_url(url)
    uri = URI.parse(url.to_s.strip)
    return unless uri.is_a?(URI::HTTP) && uri.host

    PROVIDERS.each do |provider|
      web_roots(provider).each do |host, prefix|
        next unless host == uri.host.downcase && uri.path.start_with?("#{prefix}/")

        repository, number = client_class(provider).parse_path(uri.path.delete_prefix(prefix))
        return [provider, repository, number] if repository && valid_repository?(provider, repository)
      end
    end
    nil
  rescue URI::InvalidURIError
    nil
  end
end
