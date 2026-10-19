# frozen_string_literal: true

require 'net/http'
require 'zlib'

module RedminePullRequests
  # Base class for the GitHub and GitLab REST API clients
  class Client
    class Error < StandardError; end

    # Lists are loaded with up to MAX_PAGES pages of 100 entries
    MAX_PAGES = 10

    NETWORK_ERRORS = [JSON::ParserError, SocketError, SystemCallError, Timeout::Error, OpenSSL::SSL::SSLError,
                      IOError, Net::ProtocolError, Net::HTTPBadResponse, Zlib::Error, URI::Error].freeze

    def initialize(api_url: RedminePullRequests.api_url(provider), token: RedminePullRequests.token(provider))
      @api_url = api_url.chomp('/')
      @token = token
    end

    def provider
      self.class.provider
    end

    # Rejects webhook payloads with unexpected repository names or numbers,
    # they are used in API URLs
    def self.validate_reference!(repository, number)
      raise InvalidPayload, 'invalid repository' unless RedminePullRequests.valid_repository?(provider, repository)
      raise InvalidPayload, 'invalid number' unless number.is_a?(Integer) && number.positive?
    end

    private

    # The repository name with the case used by GitHub/GitLab
    def canonical_repository(repository, canonical)
      canonical.is_a?(String) && canonical.casecmp?(repository) ? canonical : repository
    end

    # GETs all pages of a list, +key+ is the list attribute of the response
    def get_list(path, key: nil)
      separator = path.include?('?') ? '&' : '?'
      (1..MAX_PAGES).each_with_object([]) do |page, list|
        data, = get("#{path}#{separator}per_page=100&page=#{page}")
        entries = key ? (data[key] if data.is_a?(Hash)) : data
        raise Error, 'invalid response' unless entries.is_a?(Array)

        list.concat(entries)
        break list if entries.size < 100
      end
    end

    # Runs a request for optional details, returns {} if it fails
    def optional
      yield
    rescue Error => e
      Rails.logger.info("[redmine_pull_requests] #{provider} details not loaded: #{e.message}")
      {}
    end

    # Like #optional for a list, returns nil if it fails
    def optional_list
      yield
    rescue Error => e
      Rails.logger.info("[redmine_pull_requests] #{provider} details not loaded: #{e.message}")
      nil
    end

    def get(path)
      request(Net::HTTP::Get, @api_url + path)
    end

    # POSTs JSON to an absolute URL, returns the parsed response
    def post(url, body)
      data, = request(Net::HTTP::Post, url, body)
      data
    end

    def request(method, url, body = nil)
      uri = URI.parse(url)
      raise Error, "invalid API URL #{url}" unless uri.is_a?(URI::HTTP) && uri.host

      request = method.new(uri)
      request['Accept'] = 'application/json'
      if body
        request['Content-Type'] = 'application/json'
        request.body = body.to_json
      end
      request['User-Agent'] = 'redmine_pull_requests'
      authorize(request) if @token

      response = Net::HTTP.start(uri.host, uri.port, use_ssl: uri.scheme == 'https',
                                 open_timeout: 5, read_timeout: 10) do |http|
        http.request(request)
      end
      raise Error, error_message(response) unless response.is_a?(Net::HTTPSuccess)

      [JSON.parse(response.body), response]
    rescue *NETWORK_ERRORS => e
      raise Error, e.message
    end

    def error_message(response)
      message = JSON.parse(response.body)['message'] rescue nil
      message = message.presence || response.message
      # GitLab messages already start with the status code ("404 Not found")
      message.to_s.start_with?(response.code) ? message : "#{response.code} #{message}"
    end
  end
end
