# Changelog

## 1.1.0

- French, Spanish, Japanese, Simplified Chinese, Polish and Russian translations
- README in Simplified Chinese, Japanese and Spanish

## 1.0.0

First release.

- Link GitHub pull requests and GitLab merge requests to Redmine issues, several per issue and one pull request to several issues
- GitHub-like panel on the issue page: state, author, branches, commits, diff stats, reviewers with their review state, review decision, checks / pipeline, comments and unresolved threads
- Compact list for issues with several pull requests, rows expand to the full details
- Allowed repositories per project: webhooks and manual links only reach projects that list the repository
- Webhooks for GitHub and GitLab: automatic linking from references in title, description and branch name, live updates of state, reviews, comments and checks (reloaded in a background job)
- Fixing keywords (`Fixes #123`) update the issue when the pull request is merged
- REST API to list, link, refresh and unlink pull requests (JSON and XML)
- GitHub Enterprise and self-managed GitLab
- Redmine 5.0 to 7.0, Ruby 2.7 or newer
- Accessible markup (screen reader names, keyboard focus), right-to-left languages, small screens and print
- English and German translations
