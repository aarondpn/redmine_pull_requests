# frozen_string_literal: true

module RedminePullRequests
  # The repositories a project allows, one pattern per line (case-insensitive):
  #
  #   acme/web           # GitHub and GitLab
  #   github:acme/*      # all repositories of acme on GitHub (one level)
  #   gitlab:acme/**     # all projects of the acme group and its subgroups
  #
  # Blank lines and lines starting with # are ignored.
  class RepositoryPatterns
    Pattern = Struct.new(:provider, :regexp)

    SEGMENT_RE = /\A(?:[\w.-]+|\*{1,2})\z/

    attr_reader :text, :errors

    def initialize(text)
      @text = text
      @patterns = []
      @errors = []
      text.to_s.each_line.with_index(1) do |line, number|
        line = line.strip
        next if line.empty? || line.start_with?('#')

        if (pattern = parse(line))
          @patterns << pattern
        else
          @errors << [number, line]
        end
      end
    end

    def empty?
      @patterns.empty?
    end

    def allows?(provider, repository)
      @patterns.any? do |pattern|
        (pattern.provider.nil? || pattern.provider == provider) && pattern.regexp.match?(repository.to_s)
      end
    end

    private

    def parse(line)
      provider, path = line.match(/\A(?:(\w+):)?(.+)\z/).captures
      provider = provider&.downcase
      return if provider && !PROVIDERS.include?(provider)

      segments = path.split('/', -1)
      return if segments.size < 2
      return unless segments.all? { |segment| segment.match?(SEGMENT_RE) && !segment.match?(/\A\.+\z/) }
      # "**" matches any depth, so it is only allowed at the end
      return if segments[0..-2].include?('**')
      # GitHub repositories are always "owner/repo"
      return if provider == 'github' && (segments.size > 2 || segments.last == '**')

      regexp = segments.map do |segment|
        case segment
        when '*' then '[^/]+'
        when '**' then '[^/]+(?:/[^/]+)*'
        else Regexp.escape(segment)
        end
      end.join('/')
      Pattern.new(provider, /\A#{regexp}\z/i)
    end
  end
end
