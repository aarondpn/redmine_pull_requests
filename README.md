# Redmine Pull Requests

[![E2E](https://github.com/aarondpn/redmine_pull_requests/actions/workflows/e2e.yml/badge.svg)](https://github.com/aarondpn/redmine_pull_requests/actions/workflows/e2e.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
![Redmine 5.0 – 7.0](https://img.shields.io/badge/Redmine-5.0%20%E2%80%93%207.0-b32024)

Link GitHub pull requests and GitLab merge requests to Redmine issues and see their state, reviews and checks right on the issue page, styled like GitHub.

![Pull requests on a Redmine issue](docs/hero.png)

## Features

- **Multiple pull requests per issue**, and one pull request can be linked to several issues
- **GitHub and GitLab** side by side, including GitHub Enterprise, self-managed GitLab and GitLab subgroups
- **Live state**: open, draft, merged and closed, with author, branches, commits and diff stats
- **Review details**: reviewers and their review state, approved / changes requested / review required, CI checks or GitLab pipeline, comments and unresolved threads
- **Compact list** for issues with several pull requests, each row expands to the full details
- **Link by URL**: paste one or more pull/merge request URLs
- **Allowed repositories per project**, so webhooks and links only reach the projects that trust a repository
- **Webhooks**: automatic linking from `#123` in the title, description or branch name, live updates of state, reviews and checks
- **Fixing keywords**: merging a pull request that says `Fixes #123` resolves the issue, just like a commit would
- **REST API** to list, link, refresh and unlink pull requests from scripts and CI
- Permissions per role, English and German, Redmine 5.0 to 7.0

### See it in action

![Linking pull requests and expanding the details](docs/demo.gif)

<table>
  <tr>
    <td width="50%"><img src="docs/details.png" alt="A pull request with reviewers, review decision, checks, comments and unresolved threads"></td>
    <td width="50%"><img src="docs/compact.png" alt="Compact list with GitHub pull requests and a GitLab merge request"></td>
  </tr>
  <tr>
    <td><b>Everything at a glance</b><br>Reviewers with their review state, review decision, checks, comments and unresolved threads.</td>
    <td><b>Compact when it gets busy</b><br>Several pull requests collapse into a list. GitHub and GitLab side by side.</td>
  </tr>
  <tr>
    <td width="50%"><img src="docs/link.png" alt="Linking pull requests by pasting their URLs"></td>
    <td width="50%"><img src="docs/webhook.png" alt="Issue resolved automatically after the pull request was merged"></td>
  </tr>
  <tr>
    <td><b>Link by URL</b><br>Paste one or more pull or merge request URLs, the details are loaded from the API.</td>
    <td><b>Resolved on merge</b><br>A merged pull request that says <code>Fixes #123</code> resolves the issue, linked via webhook.</td>
  </tr>
</table>

## Compatibility

| Redmine | Rails | Tested in CI |
| --- | --- | --- |
| 7.0 | 8.1 | 7.0 |
| 6.0, 6.1 | 7.2 | 6.1 |
| 5.0, 5.1 | 6.1 | 5.1 |

Every change is tested end to end against the latest minor release of each major version, both from a bind-mounted checkout and installed from a release archive. The plugin needs no additional gems. It needs Ruby 2.7 or newer, which only matters for Redmine 5.0: that version still allows Ruby 2.5 and 2.6.

## Installation

Download `redmine_pull_requests-vX.Y.Z.tar.gz` from the [latest release](https://github.com/aarondpn/redmine_pull_requests/releases/latest) and extract it into Redmine's `plugins` directory (or clone the repository there), then run the migrations. On Redmine 6.0 and newer, also precompile the assets:

```sh
cd /path/to/redmine
tar xzf redmine_pull_requests-vX.Y.Z.tar.gz -C plugins
# or: git clone https://github.com/aarondpn/redmine_pull_requests.git plugins/redmine_pull_requests
bundle exec rake redmine:plugins:migrate RAILS_ENV=production
bundle exec rake assets:precompile RAILS_ENV=production   # Redmine 6.0 and newer
```

The plugin directory must be named `redmine_pull_requests` (the archives already contain it). Redmine 6.0+ only rebuilds its assets by itself when an asset file is newer than the last build, and the files in a release archive carry the release date. Without `assets:precompile` the plugin's stylesheet and script return 404, so the panel is unstyled and rows can't be expanded.

Restart Redmine, then:

1. Configure the plugin in *Administration » Plugins » Pull Requests » Configure*.
2. Grant **View pull requests**, **Manage pull requests** and **Manage pull request settings** to your roles (*Administration » Roles and permissions*).
3. Enable the **Pull requests** module in the project settings and list the project's repositories in *Project » Settings » Pull requests* (see [allowed repositories](#allowed-repositories)). Until then nothing can be linked in that project.

Release archives come with a [build provenance attestation](https://docs.github.com/actions/security-for-github-actions/using-artifact-attestations). Verify a download with `gh attestation verify redmine_pull_requests-vX.Y.Z.tar.gz -R aarondpn/redmine_pull_requests`.

### Upgrading

Replace the plugin directory with the new version (or `git pull`), run `bundle exec rake redmine:plugins:migrate RAILS_ENV=production`, on Redmine 6.0 and newer `bundle exec rake assets:precompile RAILS_ENV=production`, and restart Redmine. Check the [changelog](CHANGELOG.md) for steps a version needs.

### Uninstalling

```sh
bundle exec rake redmine:plugins:migrate NAME=redmine_pull_requests VERSION=0 RAILS_ENV=production
rm -r plugins/redmine_pull_requests
```

This drops the plugin's tables. Restart Redmine afterwards.

Redmine keeps a few things that do no harm: the *Pull requests* module entry of projects, the plugin settings and the published assets in `public/plugin_assets/redmine_pull_requests` (Redmine 5) or `public/assets/plugin_assets/redmine_pull_requests` (Redmine 6.0+). To remove them as well:

```sh
bundle exec rails runner -e production "EnabledModule.where(name: 'pull_requests').delete_all; Setting.where(name: 'plugin_redmine_pull_requests').delete_all"
rm -rf public/plugin_assets/redmine_pull_requests public/assets/plugin_assets/redmine_pull_requests
```

## Configuration

GitHub and GitLab each have their own section in the plugin settings:

| Setting | Description |
| --- | --- |
| URL / API URL | GitHub: `https://github.com`, `https://api.github.com` (Enterprise: `https://github.example.com/api/v3`). GitLab: `https://gitlab.com`, `https://gitlab.com/api/v4`, self-managed also under a path like `https://example.com/gitlab`. |
| Access token | See [access tokens](#access-tokens). Needed for private repositories and to update reviews and checks from webhooks. Can be set with `REDMINE_PR_GITHUB_TOKEN` / `REDMINE_PR_GITLAB_TOKEN`. |
| Webhook secret | Required for the webhook. Can be set with `REDMINE_PR_GITHUB_WEBHOOK_SECRET` / `REDMINE_PR_GITLAB_WEBHOOK_SECRET`. |

Stored tokens and secrets are not shown on the settings page. Leave a field blank to keep the stored value, or tick *Remove* to clear it. They are filtered from the Rails log; setting them with the `REDMINE_PR_*` environment variables keeps them out of the database as well.

Shared linking options:

| Setting | Description |
| --- | --- |
| Link plain `#123` references | Otherwise only references with one of Redmine's commit keywords (`refs #123`, `fixes #123`) are linked. |
| Link by branch name | Links branches like `123-login`, `feature/123-login` or `issue-123`. |
| Apply fixing keywords on merge | Uses the *Fixing keywords* from *Administration » Settings » Repositories*. |

### Allowed repositories

Each project decides which repositories may be linked to its issues, in *Project » Settings » Pull requests* (needs the *Manage pull request settings* permission and the module enabled). One pattern per line, case doesn't matter:

- `acme/web`: this repository, on GitHub and GitLab
- `acme/*`: all repositories of `acme` (one level)
- `acme/**`: all projects of the GitLab group `acme`, including subgroups
- `github:acme/web` or `gitlab:acme/**`: a pattern for one provider only

Blank lines and lines starting with `#` are ignored. Webhooks only link issues, and only apply fixing keywords to issues, in projects that allow the pull request's repository; references to issues in other projects are ignored. Manual links and the REST API only accept allowed repositories. While a project's list is empty, nothing can be linked there; pull requests that were already linked stay visible. Subprojects don't inherit the list.

Everyone with *Manage pull requests* in a project can load any pull request of the project's allowed repositories with the configured access token, and everyone with *Manage pull request settings* can change which repositories those are. Grant that permission like other project configuration rights, and limit the token to the repositories that belong in Redmine.

The allow-list protects against pull requests from repositories a project doesn't trust, for example forks of a public repository. It relies on the webhook secret: there is one secret per provider, and whoever knows it can send events in the name of any repository. Treat the secrets like passwords and only add the webhook to repositories and organizations whose admins you trust.

### Access tokens

The plugin only reads from GitHub and GitLab.

- **GitHub, fine-grained token**: repository permissions *Pull requests* and *Commit statuses*, both read-only (*Metadata* read-only is added automatically). GitHub doesn't offer the *Checks* permission for fine-grained tokens, so on private repositories such a token can't load check runs (e.g. GitHub Actions). Use a classic token if you need them.
- **GitHub, classic token**: the `repo` scope for private repositories, including check runs. No scope is needed for public repositories.
- **GitLab**: a personal, group or project access token with the `read_api` scope.

Public repositories work without a token, but GitHub then allows only 60 requests per hour. If the token lacks a permission, the plugin leaves out the details it can't load (reviews, checks, unresolved threads, GitLab commit counts) and only writes the error to Redmine's log. Check the token's permissions first when checks don't show up.

### GitHub webhook

In your repository or organization settings add a webhook:

- **Payload URL**: `https://redmine.example.com/pull_requests/github/webhook`
- **Content type**: `application/json`
- **Secret**: the GitHub webhook secret from the plugin settings
- **Events**: *Pull requests*, plus *Pull request reviews*, *Pull request review comments*, *Pull request review threads*, *Issue comments*, *Check runs*, *Check suites* and *Statuses* to keep reviews and checks up to date

### GitLab webhook

In your project settings, or the group settings on GitLab Premium and Ultimate (*Settings » Webhooks*), add a webhook:

- **URL**: `https://redmine.example.com/pull_requests/gitlab/webhook`
- **Secret token**: the GitLab webhook secret from the plugin settings
- **Trigger**: *Merge request events*, plus *Comments* and *Pipeline events* to keep discussions and pipelines up to date

Webhook payloads don't include reviews, checks or (on GitLab) the author and commit count. With an access token configured, the plugin reloads these from the API in a background job (Rails ActiveJob, which runs inside the Redmine process unless you configured another queue adapter), so webhook deliveries are answered right away. The job starts after a few seconds, and deliveries for the same pull request that arrive until then are covered by that one reload. Without a token, they are only updated when you click *Refresh*. Unresolved review threads on GitHub come from the GraphQL API and need a token.

### Linking

Webhooks keep linked pull/merge requests up to date. Referenced issues are linked when a pull request is opened, edited, reopened or marked ready for review, as long as the issue's project has the module enabled and [allows the repository](#allowed-repositories). On GitLab, an edit links issues only if it changes the title, description or draft status, not on pushes, labels, assignees or reviewers. At most 50 references per event are processed. A link you remove by hand is not added again by later pushes. Branch names like `release/2024-10`, `v2.3.1` or `2024-q3` don't link issues. Issues are also recognized by their full URL, e.g. `https://redmine.example.com/issues/123`, if it matches *Host name and path* in *Administration » Settings » General*.

Fixing keywords are applied once per pull request, when the merge event arrives. Status changes from fixing keywords are recorded as made by *Anonymous*, like Redmine's own commit processing does for committers it can't map to a user.

## REST API

Requires *Enable REST web service* in *Administration » Settings » API*. Authentication and status codes work like the rest of the Redmine API (`X-Redmine-API-Key` header, `.json` or `.xml`). Reading needs the *View pull requests* permission, all other endpoints need *Manage pull requests*.

| Method | Path | |
| --- | --- | --- |
| `GET` | `/issues/:issue_id/pull_requests.json` | Pull requests linked to the issue |
| `GET` | `/issues/:issue_id/pull_requests/:id.json` | One pull request |
| `POST` | `/issues/:issue_id/pull_requests.json` | Link pull/merge requests by URL, returns `201` with the linked pull requests |
| `POST` | `/issues/:issue_id/pull_requests/:id/refresh.json` | Reload from GitHub/GitLab |
| `DELETE` | `/issues/:issue_id/pull_requests/:id.json` | Unlink, returns `204` |

```sh
curl -X POST https://redmine.example.com/issues/123/pull_requests.json \
  -H "X-Redmine-API-Key: $REDMINE_API_KEY" -H "Content-Type: application/json" \
  -d '{"pull_request": {"urls": ["https://github.com/acme/web/pull/42",
                                 "https://gitlab.com/acme/platform/web/-/merge_requests/7"]}}'
```

`{"pull_request": {"url": "..."}}` links a single URL, at most 20 URLs per request. Linking is idempotent. If one of the URLs is invalid, not [allowed in the project](#allowed-repositories) or can't be loaded, nothing is stored and the response is `422` with the reasons:

```json
{"errors": ["acme/secret is not allowed in this project (project settings › Pull requests).", "Could not load acme/web#9999 from GitHub (404 Not Found)."]}
```

A pull request looks like this (shortened):

```json
{
  "id": 1, "provider": "github", "repository": "acme/web", "number": 42, "reference": "acme/web#42",
  "url": "https://github.com/acme/web/pull/42", "title": "Add OAuth login with GitHub and Google",
  "state": "open", "status": "open", "draft": false,
  "author": {"login": "octocat", "avatar_url": "https://avatars.githubusercontent.com/u/583231"},
  "head_ref": "feature/oauth-login", "base_ref": "main", "head_sha": "6dcb09b5",
  "commits_count": 7, "additions": 1312, "deletions": 48, "changed_files": 23,
  "review_decision": "approved",
  "reviewers": [{"login": "monalisa", "state": "approved", "avatar_url": "..."}],
  "comments_count": 12, "unresolved_threads_count": 2,
  "checks": {"state": "pending", "total": 4, "passed": 3, "failed": 0, "url": "https://github.com/acme/web/pull/42/checks"},
  "opened_on": "2026-10-17T18:30:54Z", "synced_on": "2026-10-19T18:36:19Z",
  "linked_on": "2026-10-19T18:36:19Z", "linked_by": {"id": 5, "name": "Dana Tester"}, "link_source": "manual"
}
```

Unknown values are `null`, except for `author`, `merged_by`, `checks` and `linked_by`, which are left out when unknown: `merged_by` is only there for merged pull requests, `checks` once checks or a pipeline exist, and `linked_by` for links made by a user (not by a webhook). `merged_on` and `closed_on` are always there and `null` while the pull request is open.

- `state`: `open`, `merged` or `closed`. `status` also distinguishes `draft`.
- `review_decision`: `approved`, `changes_requested`, `review_required` or `null`.
- Reviewer `state`: `approved`, `changes_requested`, `commented` or `pending`.
- `checks.state`: `success`, `failure`, `pending` or `neutral`. On GitLab this is the pipeline status, `total`, `passed` and `failed` are `null`.
- `link_source`: `manual` (UI/API) or `webhook`.

## Development

The E2E tests start Redmine and a mock GitHub/GitLab API with Docker and run with [Playwright](https://playwright.dev):

```sh
cd e2e
npm install
npx playwright install chromium
npm test                            # starts Redmine 7.0, seeds it and runs all tests
REDMINE_IMAGE=redmine:5.1 npm test  # any other Redmine image
npm run screenshots                 # regenerates the images in docs/
npm run stack:down                  # removes the containers
./install-test.sh 6.1               # installs a release archive of HEAD into a fresh redmine:6.1
```

Set `E2E_SKIP_STACK=1` to reuse a running, already seeded stack.

Redmine runs at http://localhost:3000 during the tests (log in with `admin` / `admin12345`, `manager`, `dev` or `reporter` with `password123`). To use other ports, set `REDMINE_PORT` and `MOCK_API_PORT` together with `REDMINE_URL` and `MOCK_API_URL`.

## Releasing

1. Update `version` in `init.rb` and add a section for it to `CHANGELOG.md`.
2. Commit, then tag and push: `git tag v1.2.3 && git push origin v1.2.3`.

The release workflow runs the E2E tests on the tagged commit, checks that the tag matches `init.rb`, builds the archives and publishes a GitHub release with the changelog section as notes. Tags with a suffix like `v1.3.0-rc.1` are published as pre-releases and don't become the latest release.

## Security

See [SECURITY.md](SECURITY.md) for how to report vulnerabilities.

## License

[MIT](LICENSE)

## Credits

Icons are [GitHub Octicons](https://github.com/primer/octicons) (MIT) and the GitLab logo from [Simple Icons](https://simpleicons.org) (CC0).
