# frozen_string_literal: true

module PullRequestsHelper
  # GitHub Octicons (MIT License, https://github.com/primer/octicons)
  OCTICONS = {
    'git-pull-request' => 'M1.5 3.25a2.25 2.25 0 1 1 3 2.122v5.256a2.251 2.251 0 1 1-1.5 0V5.372A2.25 2.25 0 0 1 1.5 3.25Zm5.677-.177L9.573.677A.25.25 0 0 1 10 .854V2.5h1A2.5 2.5 0 0 1 13.5 5v5.628a2.251 2.251 0 1 1-1.5 0V5a1 1 0 0 0-1-1h-1v1.646a.25.25 0 0 1-.427.177L7.177 3.427a.25.25 0 0 1 0-.354ZM3.75 2.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Zm0 9.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Zm8.25.75a.75.75 0 1 0 1.5 0 .75.75 0 0 0-1.5 0Z',
    'git-merge' => 'M5.45 5.154A4.25 4.25 0 0 0 9.25 7.5h1.378a2.251 2.251 0 1 1 0 1.5H9.25A5.734 5.734 0 0 1 5 7.123v3.505a2.25 2.25 0 1 1-1.5 0V5.372a2.25 2.25 0 1 1 1.95-.218ZM4.25 13.5a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Zm8.5-4.5a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5ZM5 3.25a.75.75 0 1 0 0 .005V3.25Z',
    'git-pull-request-closed' => 'M3.25 1A2.25 2.25 0 0 1 4 5.372v5.256a2.251 2.251 0 1 1-1.5 0V5.372A2.251 2.251 0 0 1 3.25 1Zm9.5 5.5a.75.75 0 0 1 .75.75v3.378a2.251 2.251 0 1 1-1.5 0V7.25a.75.75 0 0 1 .75-.75Zm-2.03-5.273a.75.75 0 0 1 1.06 0l.97.97.97-.97a.748.748 0 0 1 1.265.332.75.75 0 0 1-.205.729l-.97.97.97.97a.751.751 0 0 1-.018 1.042.751.751 0 0 1-1.042.018l-.97-.97-.97.97a.749.749 0 0 1-1.275-.326.749.749 0 0 1 .215-.734l.97-.97-.97-.97a.75.75 0 0 1 0-1.06ZM2.5 3.25a.75.75 0 1 0 1.5 0 .75.75 0 0 0-1.5 0ZM3.25 12a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Zm9.5 0a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Z',
    'git-pull-request-draft' => 'M3.25 1A2.25 2.25 0 0 1 4 5.372v5.256a2.251 2.251 0 1 1-1.5 0V5.372A2.251 2.251 0 0 1 3.25 1Zm9.5 14a2.25 2.25 0 1 1 0-4.5 2.25 2.25 0 0 1 0 4.5ZM2.5 3.25a.75.75 0 1 0 1.5 0 .75.75 0 0 0-1.5 0ZM3.25 12a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Zm9.5 0a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5ZM14 7.5a1.25 1.25 0 1 1-2.5 0 1.25 1.25 0 0 1 2.5 0Zm0-4.25a1.25 1.25 0 1 1-2.5 0 1.25 1.25 0 0 1 2.5 0Z',
    'sync' => 'M1.705 8.005a.75.75 0 0 1 .834.656 5.5 5.5 0 0 0 9.592 2.97l-1.204-1.204a.25.25 0 0 1 .177-.427h3.646a.25.25 0 0 1 .25.25v3.646a.25.25 0 0 1-.427.177l-1.38-1.38A7.002 7.002 0 0 1 1.05 8.84a.75.75 0 0 1 .656-.834ZM8 2.5a5.487 5.487 0 0 0-4.131 1.869l1.204 1.204A.25.25 0 0 1 4.896 6H1.25A.25.25 0 0 1 1 5.75V2.104a.25.25 0 0 1 .427-.177l1.38 1.38A7.002 7.002 0 0 1 14.95 7.16a.75.75 0 0 1-1.49.178A5.5 5.5 0 0 0 8 2.5Z',
    'x' => 'M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.749.749 0 0 1 1.275.326.749.749 0 0 1-.215.734L9.06 8l3.22 3.22a.749.749 0 0 1-.326 1.275.749.749 0 0 1-.734-.215L8 9.06l-3.22 3.22a.751.751 0 0 1-1.042-.018.751.751 0 0 1-.018-1.042L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06Z',
    'link' => 'm7.775 3.275 1.25-1.25a3.5 3.5 0 1 1 4.95 4.95l-2.5 2.5a3.5 3.5 0 0 1-4.95 0 .751.751 0 0 1 .018-1.042.751.751 0 0 1 1.042-.018 1.998 1.998 0 0 0 2.83 0l2.5-2.5a2.002 2.002 0 0 0-2.83-2.83l-1.25 1.25a.751.751 0 0 1-1.042-.018.751.751 0 0 1-.018-1.042Zm-4.69 9.64a1.998 1.998 0 0 0 2.83 0l1.25-1.25a.751.751 0 0 1 1.042.018.751.751 0 0 1 .018 1.042l-1.25 1.25a3.5 3.5 0 1 1-4.95-4.95l2.5-2.5a3.5 3.5 0 0 1 4.95 0 .751.751 0 0 1-.018 1.042.751.751 0 0 1-1.042.018 1.998 1.998 0 0 0-2.83 0l-2.5 2.5a1.998 1.998 0 0 0 0 2.83Z',
    'check-circle' => 'M0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8Zm1.5 0a6.5 6.5 0 1 0 13 0 6.5 6.5 0 0 0-13 0Zm10.28-1.72-4.5 4.5a.75.75 0 0 1-1.06 0l-2-2a.751.751 0 0 1 .018-1.042.751.751 0 0 1 1.042-.018l1.47 1.47 3.97-3.97a.751.751 0 0 1 1.042.018.751.751 0 0 1 .018 1.042Z',
    'check' => 'M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.751.751 0 0 1 .018-1.042.751.751 0 0 1 1.042-.018L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0Z',
    'file-diff' => 'M1 1.75C1 .784 1.784 0 2.75 0h7.586c.464 0 .909.184 1.237.513l2.914 2.914c.329.328.513.773.513 1.237v9.586A1.75 1.75 0 0 1 13.25 16H2.75A1.75 1.75 0 0 1 1 14.25Zm1.75-.25a.25.25 0 0 0-.25.25v12.5c0 .138.112.25.25.25h10.5a.25.25 0 0 0 .25-.25V4.664a.25.25 0 0 0-.073-.177l-2.914-2.914a.25.25 0 0 0-.177-.073ZM8 3.25a.75.75 0 0 1 .75.75v1.5h1.5a.75.75 0 0 1 0 1.5h-1.5v1.5a.75.75 0 0 1-1.5 0V7h-1.5a.75.75 0 0 1 0-1.5h1.5V4A.75.75 0 0 1 8 3.25Zm-3 8a.75.75 0 0 1 .75-.75h4.5a.75.75 0 0 1 0 1.5h-4.5a.75.75 0 0 1-.75-.75Z',
    'comment' => 'M1 2.75C1 1.784 1.784 1 2.75 1h10.5c.966 0 1.75.784 1.75 1.75v7.5A1.75 1.75 0 0 1 13.25 12H9.06l-2.573 2.573A1.458 1.458 0 0 1 4 13.543V12H2.75A1.75 1.75 0 0 1 1 10.25Zm1.75-.25a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h2a.75.75 0 0 1 .75.75v2.19l2.72-2.72a.749.749 0 0 1 .53-.22h4.5a.25.25 0 0 0 .25-.25v-7.5a.25.25 0 0 0-.25-.25Z',
    'comment-discussion' => 'M1.75 1h8.5c.966 0 1.75.784 1.75 1.75v5.5A1.75 1.75 0 0 1 10.25 10H7.061l-2.574 2.573A1.458 1.458 0 0 1 2 11.543V10h-.25A1.75 1.75 0 0 1 0 8.25v-5.5C0 1.784.784 1 1.75 1ZM1.5 2.75v5.5c0 .138.112.25.25.25h1a.75.75 0 0 1 .75.75v2.19l2.72-2.72a.749.749 0 0 1 .53-.22h3.5a.25.25 0 0 0 .25-.25v-5.5a.25.25 0 0 0-.25-.25h-8.5a.25.25 0 0 0-.25.25Zm13 2a.25.25 0 0 0-.25-.25h-.5a.75.75 0 0 1 0-1.5h.5c.966 0 1.75.784 1.75 1.75v5.5A1.75 1.75 0 0 1 14.25 12H14v1.543a1.458 1.458 0 0 1-2.487 1.03L9.22 12.28a.749.749 0 0 1 .326-1.275.749.749 0 0 1 .734.215l2.22 2.22v-2.19a.75.75 0 0 1 .75-.75h1a.25.25 0 0 0 .25-.25Z',
    'dot-fill' => 'M8 4a4 4 0 1 1 0 8 4 4 0 0 1 0-8Z',
    'eye' => 'M8 2c1.981 0 3.671.992 4.933 2.078 1.27 1.091 2.187 2.345 2.637 3.023a1.62 1.62 0 0 1 0 1.798c-.45.678-1.367 1.932-2.637 3.023C11.67 13.008 9.981 14 8 14c-1.981 0-3.671-.992-4.933-2.078C1.797 10.83.88 9.576.43 8.898a1.62 1.62 0 0 1 0-1.798c.45-.677 1.367-1.931 2.637-3.022C4.33 2.992 6.019 2 8 2ZM1.679 7.932a.12.12 0 0 0 0 .136c.411.622 1.241 1.75 2.366 2.717C5.176 11.758 6.527 12.5 8 12.5c1.473 0 2.825-.742 3.955-1.715 1.124-.967 1.954-2.096 2.366-2.717a.12.12 0 0 0 0-.136c-.412-.621-1.242-1.75-2.366-2.717C10.824 4.242 9.473 3.5 8 3.5c-1.473 0-2.825.742-3.955 1.715-1.124.967-1.954 2.096-2.366 2.717ZM8 10a2 2 0 1 1-.001-3.999A2 2 0 0 1 8 10Z',
    'skip' => 'M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0ZM1.5 8a6.5 6.5 0 1 0 13 0 6.5 6.5 0 0 0-13 0Zm9.78-2.22-5.5 5.5a.749.749 0 0 1-1.275-.326.749.749 0 0 1 .215-.734l5.5-5.5a.751.751 0 0 1 1.042.018.751.751 0 0 1 .018 1.042Z',
    'chevron-down' => 'M12.78 5.22a.749.749 0 0 1 0 1.06l-4.25 4.25a.749.749 0 0 1-1.06 0L3.22 6.28a.749.749 0 1 1 1.06-1.06L8 8.939l3.72-3.719a.749.749 0 0 1 1.06 0Z',
    'unfold' => 'm8.177.677 2.896 2.896a.25.25 0 0 1-.177.427H8.75v1.25a.75.75 0 0 1-1.5 0V4H5.104a.25.25 0 0 1-.177-.427L7.823.677a.25.25 0 0 1 .354 0ZM7.25 10.75a.75.75 0 0 1 1.5 0V12h2.146a.25.25 0 0 1 .177.427l-2.896 2.896a.25.25 0 0 1-.354 0l-2.896-2.896A.25.25 0 0 1 5.104 12H7.25v-1.25Zm-5-2a.75.75 0 0 0 0-1.5h-.5a.75.75 0 0 0 0 1.5h.5ZM6 8a.75.75 0 0 1-.75.75h-.5a.75.75 0 0 1 0-1.5h.5A.75.75 0 0 1 6 8Zm2.25.75a.75.75 0 0 0 0-1.5h-.5a.75.75 0 0 0 0 1.5h.5ZM12 8a.75.75 0 0 1-.75.75h-.5a.75.75 0 0 1 0-1.5h.5A.75.75 0 0 1 12 8Zm2.25.75a.75.75 0 0 0 0-1.5h-.5a.75.75 0 0 0 0 1.5h.5Z',
    'fold' => 'M10.896 2H8.75V.75a.75.75 0 0 0-1.5 0V2H5.104a.25.25 0 0 0-.177.427l2.896 2.896a.25.25 0 0 0 .354 0l2.896-2.896A.25.25 0 0 0 10.896 2ZM8.75 15.25a.75.75 0 0 1-1.5 0V14H5.104a.25.25 0 0 1-.177-.427l2.896-2.896a.25.25 0 0 1 .354 0l2.896 2.896a.25.25 0 0 1-.177.427H8.75v1.25Zm-6.5-6.5a.75.75 0 0 0 0-1.5h-.5a.75.75 0 0 0 0 1.5h.5ZM6 8a.75.75 0 0 1-.75.75h-.5a.75.75 0 0 1 0-1.5h.5A.75.75 0 0 1 6 8Zm2.25.75a.75.75 0 0 0 0-1.5h-.5a.75.75 0 0 0 0 1.5h.5ZM12 8a.75.75 0 0 1-.75.75h-.5a.75.75 0 0 1 0-1.5h.5A.75.75 0 0 1 12 8Zm2.25.75a.75.75 0 0 0 0-1.5h-.5a.75.75 0 0 0 0 1.5h.5Z',
    'git-branch' => 'M9.5 3.25a2.25 2.25 0 1 1 3 2.122V6A2.5 2.5 0 0 1 10 8.5H6a1 1 0 0 0-1 1v1.128a2.251 2.251 0 1 1-1.5 0V5.372a2.25 2.25 0 1 1 1.5 0v1.836A2.493 2.493 0 0 1 6 7h4a1 1 0 0 0 1-1v-.628A2.25 2.25 0 0 1 9.5 3.25Zm-6 0a.75.75 0 1 0 1.5 0 .75.75 0 0 0-1.5 0Zm8.25-.75a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5ZM4.25 12a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Z'
  }.freeze

  # GitHub mark (Octicons) and GitLab tanuki (Simple Icons, CC0)
  PROVIDER_ICONS = {
    'github' => ['0 0 16 16', 'M6.766 11.328c-2.063-.25-3.516-1.734-3.516-3.656 0-.781.281-1.625.75-2.188-.203-.515-.172-1.609.063-2.062.625-.078 1.468.25 1.968.703.594-.187 1.219-.281 1.985-.281.765 0 1.39.094 1.953.265.484-.437 1.344-.765 1.969-.687.218.422.25 1.515.046 2.047.5.593.766 1.39.766 2.203 0 1.922-1.453 3.375-3.547 3.64.531.344.89 1.094.89 1.954v1.625c0 .468.391.734.86.547C13.781 14.359 16 11.53 16 8.03 16 3.61 12.406 0 7.984 0 3.563 0 0 3.61 0 8.031a7.88 7.88 0 0 0 5.172 7.422c.422.156.828-.125.828-.547v-1.25c-.219.094-.5.156-.75.156-1.031 0-1.64-.562-2.078-1.609-.172-.422-.36-.672-.719-.719-.187-.015-.25-.093-.25-.187 0-.188.313-.328.625-.328.453 0 .844.281 1.25.86.313.452.64.655 1.031.655s.641-.14 1-.5c.266-.265.47-.5.657-.656'],
    'gitlab' => ['0 0 24 24', 'm23.6004 9.5927-.0337-.0862L20.3.9814a.851.851 0 0 0-.3362-.405.8748.8748 0 0 0-.9997.0539.8748.8748 0 0 0-.29.4399l-2.2055 6.748H7.5375l-2.2057-6.748a.8573.8573 0 0 0-.29-.4412.8748.8748 0 0 0-.9997-.0537.8585.8585 0 0 0-.3362.4049L.4332 9.5015l-.0325.0862a6.0657 6.0657 0 0 0 2.0119 7.0105l.0113.0087.03.0213 4.976 3.7264 2.462 1.8633 1.4995 1.1321a1.0085 1.0085 0 0 0 1.2197 0l1.4995-1.1321 2.4619-1.8633 5.006-3.7489.0125-.01a6.0682 6.0682 0 0 0 2.0094-7.003z']
  }.freeze

  STATUS_ICONS = {
    'open' => 'git-pull-request',
    'draft' => 'git-pull-request-draft',
    'merged' => 'git-merge',
    'closed' => 'git-pull-request-closed'
  }.freeze

  def pull_request_octicon(name, size: 16, css_class: nil)
    content_tag(:svg, tag.path(d: OCTICONS.fetch(name)),
                class: ['octicon', "octicon-#{name}", css_class].compact.join(' '),
                viewBox: '0 0 16 16', width: size, height: size,
                fill: 'currentColor', 'aria-hidden': 'true', focusable: 'false')
  end

  # Decorative icons are hidden from assistive technology, e.g. inside a
  # link that names the provider itself
  def pull_request_provider_icon(pull_request, size: 12, decorative: false)
    view_box, path = PROVIDER_ICONS.fetch(pull_request.provider)
    a11y = decorative ? { 'aria-hidden': 'true', focusable: 'false' } : { role: 'img', 'aria-label': pull_request.provider_name }
    content_tag(:svg, tag.path(d: path), class: "pr-provider pr-provider--#{pull_request.provider}",
                viewBox: view_box, width: size, height: size, fill: 'currentColor', **a11y)
  end

  def pull_request_status_icon(pull_request, size: 16)
    pull_request_octicon(STATUS_ICONS[pull_request.status], size: size)
  end

  def pull_request_status_label(status)
    l(:"label_pull_request_status_#{status}")
  end

  def pull_request_time_ago(time, label = :label_pull_request_time_ago)
    return ''.html_safe unless time

    content_tag(:time, l(label, age: distance_of_time_in_words(Time.now, time)),
                datetime: time.utc.iso8601, title: format_time(time))
  end

  # Redmine 5 has no thousands separator in some locales, GitHub always shows one
  def pull_request_number_with_delimiter(number)
    number_with_delimiter(number, delimiter: t('number.format.delimiter', default: '').presence || ',')
  end

  def pull_request_branch(ref)
    content_tag(:code, ref, class: 'pr-branch', title: ref) if ref.present?
  end

  def pull_request_avatar(pull_request)
    return if pull_request.author_avatar_url.blank?

    url = pull_request.author_avatar_url
    url += "#{url.include?('?') ? '&' : '?'}s=40" unless pull_request.gitlab?
    image_tag(url, class: 'pr-avatar', alt: '',
              width: 16, height: 16, loading: 'lazy')
  end

  # One-line GitHub style description, e.g.
  # "octocat merged 3 commits into main from feature/login 2 days ago"
  def pull_request_summary(pull_request)
    author = content_tag(:span, pull_request.author_login.presence || l(:label_pull_request_unknown_author), class: 'pr-author')
    commits = if pull_request.commits_count
                l(:label_pull_request_commits, count: pull_request.commits_count)
              else
                l(:label_pull_request_changes)
              end
    branches = {
      commits: commits,
      base: pull_request_branch(pull_request.base_ref) || '?',
      head: pull_request_branch(pull_request.head_ref) || '?'
    }

    sentence =
      case pull_request.status
      when 'merged'
        merger = content_tag(:span, pull_request.merged_by_login.presence || pull_request.author_login.presence ||
                                    l(:label_pull_request_unknown_author), class: 'pr-author')
        l(:text_pull_request_merged, **branches, user: merger, age: pull_request_time_ago(pull_request.merged_at))
      when 'closed'
        age = pull_request_time_ago(pull_request.closed_at)
        if pull_request.author_login.present?
          l(:"text_#{pull_request.kind}_closed", user: author, age: age)
        else
          l(:"text_#{pull_request.kind}_closed_unknown_author", age: age)
        end
      else
        l(:text_pull_request_open, **branches, user: author,
          age: pull_request_time_ago(pull_request.opened_at, :label_pull_request_opened_time_ago))
      end
    sentence.html_safe # rubocop:disable Rails/OutputSafety -- interpolated values are escaped above
  end

  REVIEWER_ICONS = { 'approved' => 'check', 'changes_requested' => 'file-diff',
                     'commented' => 'comment', 'pending' => 'dot-fill' }.freeze
  # Approvals and passed checks are often shown side by side, so they get different icons
  REVIEW_DECISION_ICONS = { 'approved' => 'check-circle', 'changes_requested' => 'file-diff', 'review_required' => 'eye' }.freeze
  CHECKS_ICONS = { 'success' => 'check', 'failure' => 'x', 'pending' => 'dot-fill', 'neutral' => 'skip' }.freeze

  # Overlapping reviewer avatars with a small review state badge each
  def pull_request_reviewers(pull_request)
    return if pull_request.reviewers.empty?

    items = pull_request.reviewers.map do |reviewer|
      state = reviewer['state']
      label = l(:"label_pull_request_reviewer_#{state}", user: reviewer['login'])
      avatar =
        if reviewer['avatar_url'].present?
          url = reviewer['avatar_url']
          url += "#{url.include?('?') ? '&' : '?'}s=40" unless pull_request.gitlab?
          image_tag(url, alt: label, width: 20, height: 20, loading: 'lazy')
        else
          content_tag(:span, reviewer['login'].to_s.first.to_s.upcase, class: 'pr-reviewer__initial',
                      role: 'img', 'aria-label': label)
        end
      content_tag(:li, avatar + content_tag(:span, pull_request_octicon(REVIEWER_ICONS.fetch(state), size: 8),
                                            class: 'pr-reviewer__badge'),
                  class: "pr-reviewer pr-reviewer--#{state}", title: label)
    end
    content_tag(:ul, safe_join(items), class: 'pr-reviewers', 'aria-label': l(:label_pull_request_reviewers))
  end

  def pull_request_review_decision(pull_request)
    decision = pull_request.review_decision
    return if decision.blank? || (decision == 'review_required' && !pull_request.open?)

    content_tag(:span, pull_request_octicon(REVIEW_DECISION_ICONS.fetch(decision), size: 14) +
                       l(:"label_pull_request_review_#{decision}"),
                class: "pr-detail pr-decision pr-decision--#{decision}")
  end

  def pull_request_checks(pull_request)
    state = pull_request.checks_state
    return if state.blank?

    text, title =
      if pull_request.checks_count.to_i.positive?
        counts = { passed: pull_request.checks_passed_count.to_i, failed: pull_request.checks_failed_count.to_i,
                   pending: pull_request.checks_pending_count, total: pull_request.checks_count }
        label = case state
                when 'failure' then l(:label_pull_request_checks_failing, count: counts[:failed])
                when 'pending' then l(:label_pull_request_checks_progress, **counts)
                else l(:label_pull_request_checks_passed, count: counts[:total])
                end
        [label, l(:label_pull_request_checks_title, **counts)]
      else
        [l(:"label_pull_request_pipeline_#{state}")] * 2
      end
    icon = pull_request_octicon(CHECKS_ICONS.fetch(state, 'dot-fill'), size: 14)
    content = icon + content_tag(:span, text, class: 'pr-detail__text')
    options = { class: "pr-detail pr-checks pr-checks--#{state}", title: title }
    if pull_request.checks_url.to_s.match?(%r{\Ahttps?://}i)
      link_to(content, pull_request.checks_url, options.merge(target: '_blank', rel: 'noopener noreferrer'))
    else
      content_tag(:span, content, options)
    end
  end

  def pull_request_comments(pull_request)
    count = pull_request.comments_count.to_i
    return unless count.positive?

    label = l(:label_pull_request_comments, count: count)
    content_tag(:span, pull_request_octicon('comment', size: 14) + count.to_s,
                class: 'pr-detail pr-comments', title: label, role: 'img', 'aria-label': label)
  end

  def pull_request_unresolved_threads(pull_request)
    count = pull_request.unresolved_threads_count.to_i
    return unless count.positive? && pull_request.open?

    content_tag(:span, pull_request_octicon('comment-discussion', size: 14) +
                       l(:label_pull_request_unresolved_threads, count: count),
                class: 'pr-detail pr-threads')
  end

  # Icon-only summary of reviews, checks, comments and threads for the
  # compact list, details are in the tooltips. The icons are named images
  # (role="img") as aria-label is not allowed on plain spans.
  def pull_request_compact_indicators(pull_request)
    items = []
    decision = pull_request.review_decision
    if decision.present? && (decision != 'review_required' || pull_request.open?)
      label = l(:"label_pull_request_review_#{decision}")
      items << content_tag(:span, pull_request_octicon(REVIEW_DECISION_ICONS.fetch(decision)),
                           class: "pr-indicator pr-decision--#{decision}", title: label, role: 'img', 'aria-label': label)
    end
    items << pull_request_checks(pull_request)
    if pull_request.comments_count.to_i.positive?
      label = l(:label_pull_request_comments, count: pull_request.comments_count)
      items << content_tag(:span, pull_request_octicon('comment') + pull_request.comments_count.to_s,
                           class: 'pr-indicator', title: label, role: 'img', 'aria-label': label)
    end
    if pull_request.unresolved_threads_count.to_i.positive? && pull_request.open?
      label = l(:label_pull_request_unresolved_threads, count: pull_request.unresolved_threads_count)
      items << content_tag(:span, pull_request_octicon('comment-discussion') + pull_request.unresolved_threads_count.to_s,
                           class: 'pr-indicator pr-indicator--threads', title: label, role: 'img', 'aria-label': label)
    end
    content_tag(:span, safe_join(items.compact), class: 'pr-compact-indicators') if items.compact.any?
  end

  # Serializes a linked pull request for the REST API (JSON and XML)
  def render_pull_request_api(api, link)
    pull_request = link.pull_request
    api.pull_request do
      api.id pull_request.id
      api.provider pull_request.provider
      api.repository pull_request.repository
      api.number pull_request.number
      api.reference pull_request.reference
      api.url pull_request.url
      api.title pull_request.title
      api.state pull_request.state
      api.status pull_request.status
      api.draft pull_request.draft?
      api.author(login: pull_request.author_login, avatar_url: pull_request.author_avatar_url) if pull_request.author_login
      api.merged_by(login: pull_request.merged_by_login) if pull_request.merged_by_login
      api.head_ref pull_request.head_ref
      api.base_ref pull_request.base_ref
      api.head_sha pull_request.head_sha
      api.commits_count pull_request.commits_count
      api.additions pull_request.additions
      api.deletions pull_request.deletions
      api.changed_files pull_request.changed_files
      api.review_decision pull_request.review_decision
      api.array :reviewers do
        pull_request.reviewers.each do |reviewer|
          api.reviewer(login: reviewer['login'], state: reviewer['state'], avatar_url: reviewer['avatar_url'])
        end
      end
      api.comments_count pull_request.comments_count
      api.unresolved_threads_count pull_request.unresolved_threads_count
      if pull_request.checks_state
        api.checks do
          api.state pull_request.checks_state
          api.total pull_request.checks_count
          api.passed pull_request.checks_passed_count
          api.failed pull_request.checks_failed_count
          api.url pull_request.checks_url
        end
      end
      api.opened_on pull_request.opened_at
      api.merged_on pull_request.merged_at
      api.closed_on pull_request.closed_at
      api.synced_on pull_request.synced_at
      api.linked_on link.created_at
      api.linked_by(id: link.user.id, name: link.user.name) if link.user
      api.link_source link.source
    end
  end

  # Aggregated counts per status, e.g. {"open" => 1, "merged" => 2}
  def pull_requests_status_counts(pull_requests)
    counts = pull_requests.map(&:status).tally
    PullRequest::STATUSES.index_with { |s| counts[s].to_i }.select { |_, n| n.positive? }
  end
end
