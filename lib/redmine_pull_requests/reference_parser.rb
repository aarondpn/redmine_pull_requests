# frozen_string_literal: true

module RedminePullRequests
  # Finds Redmine issue references in pull request titles, descriptions and
  # branch names. Uses the same keywords as repository commit messages
  # (Administration » Settings » Repositories).
  class ReferenceParser
    # A branch name segment that references an issue: "issue-123", "#123",
    # "123" or "123-login-page". A plain number must be followed by a word,
    # so versions and dates like "2.3.1", "2024-10" or "2024-q3" don't match.
    BRANCH_SEGMENT_RE = /
      \A(?:
        (?:issues?[-_]?|redmine[-_]?|\#)(\d+)(?=[-_.]|\z) |
        (\d+)(?=\z|[-_]\p{L}{2,}(?:[-_.]|\z))
      )
    /xi

    # Returns a Hash of issue id => keyword (the fix keyword or nil)
    def parse(title: nil, body: nil, branch: nil)
      refs = {}
      [title, body].compact.each { |text| scan_text(text, refs) }
      scan_issue_urls([title, body].compact.join("\n"), refs)
      scan_branch(branch, refs) if branch && RedminePullRequests.setting?('link_branch_refs')
      refs
    end

    def fix_keywords
      @fix_keywords ||= Setting.commit_update_keywords_array.pluck('keywords').flatten.compact
    end

    private

    def scan_text(text, refs)
      ref_keywords = Setting.commit_ref_keywords.downcase.split(',').collect(&:strip)
      any_ref = ref_keywords.delete('*') || RedminePullRequests.setting?('link_bare_refs')
      kw_regexp = (ref_keywords + fix_keywords).collect { |kw| Regexp.escape(kw) }.join('|')

      regexp = %r{
        ([\s(\[,-]|^)((#{kw_regexp})[\s:]+)?
        (\#\d+([\s,;&]+\#\d+)*)
        (?=[[:punct:]]|\s|<|$)
      }xi
      text.scan(regexp) do |match|
        keyword = match[2].to_s.downcase
        next unless keyword.present? || any_ref

        match[3].scan(/#(\d+)/).each do |(id)|
          add_ref(refs, id.to_i, fix_keywords.include?(keyword) ? keyword : nil)
        end
      end
    end

    def scan_issue_urls(text, refs)
      host = Setting.host_name.to_s.strip.sub(%r{\Ahttps?://}, '').chomp('/')
      return if host.blank?

      text.scan(%r{https?://#{Regexp.escape(host)}/issues/(\d+)}i) do |(id)|
        add_ref(refs, id.to_i, nil)
      end
    end

    def scan_branch(branch, refs)
      branch.split('/').each do |segment|
        if (m = segment.match(BRANCH_SEGMENT_RE))
          add_ref(refs, (m[1] || m[2]).to_i, nil)
        end
      end
    end

    def add_ref(refs, id, keyword)
      return unless id.positive?

      refs[id] = keyword || refs[id]
    end
  end
end
