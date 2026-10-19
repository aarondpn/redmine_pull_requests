<p align="center">
  <img src="docs/logo.svg" alt="redmine_pull_requests logo" width="120" />
</p>

<h1 align="center">Redmine Pull Requests</h1>

<p align="center">
  Link GitHub pull requests and GitLab merge requests to <a href="https://www.redmine.org/">Redmine</a> issues and see their state, reviews and checks right on the issue page.
</p>

<p align="center">
  <b>English</b> ·
  <a href="README.zh-CN.md">简体中文</a> ·
  <a href="README.ja.md">日本語</a> ·
  <a href="README.es.md">Español</a>
</p>

<p align="center">
  <a href="https://github.com/aarondpn/redmine_pull_requests/actions/workflows/e2e.yml"><img src="https://img.shields.io/github/actions/workflow/status/aarondpn/redmine_pull_requests/e2e.yml?style=for-the-badge&logo=githubactions&logoColor=white&label=E2E" alt="E2E"></a>
  <a href="https://github.com/aarondpn/redmine_pull_requests/releases/latest"><img src="https://img.shields.io/github/v/release/aarondpn/redmine_pull_requests?style=for-the-badge&logo=github&logoColor=white" alt="Release"></a>
  <a href="https://www.ruby-lang.org/"><img src="https://img.shields.io/badge/Ruby-2.7%2B-CC342D?style=for-the-badge&logo=ruby&logoColor=white" alt="Ruby 2.7+"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-yellow?style=for-the-badge&logo=opensourceinitiative&logoColor=white" alt="License"></a>
</p>

<p align="center">
  <a href="https://www.redmine.org/projects/redmine/wiki/changelog"><img src="https://img.shields.io/badge/Redmine-5.0%20%E2%80%93%207.0-B32024?style=for-the-badge&logo=redmine&logoColor=white" alt="Redmine 5.0 – 7.0"></a>
</p>

<p align="center">
  <a href="#installation">Installation</a> ·
  <a href="#configuration">Configuration</a> ·
  <a href="#webhooks">Webhooks</a> ·
  <a href="API.md">REST API</a>
</p>

![Pull requests on a Redmine issue](docs/hero.png)

## Features

- **GitHub and GitLab** side by side, including GitHub Enterprise, self-managed GitLab and subgroups
- **Many-to-many**: several pull requests per issue, one pull request on several issues
- **Live details**: state, author, branches, diff stats, reviewers and review decision, CI checks or pipeline, comments and unresolved threads
- **Link by URL** or automatically via **webhooks** from `#123` in the title, description or branch name
- **Fixing keywords**: merging a pull request that says `Fixes #123` resolves the issue, like a commit would
- **Allowed repositories per project**, so links only reach projects that trust a repository
- **[REST API](API.md)**, permissions per role, translated into 8 languages

![Linking pull requests and expanding the details](docs/demo.gif)

<table>
  <tr>
    <td width="50%"><img src="docs/details.png" alt="A pull request with reviewers, review decision, checks, comments and unresolved threads"></td>
    <td width="50%"><img src="docs/compact.png" alt="Compact list with GitHub pull requests and a GitLab merge request"></td>
  </tr>
</table>

## Installation

Redmine 5.0 to 7.0 (tested in CI against 5.1, 6.1 and 7.0), Ruby 2.7 or newer, no additional gems.

Extract the [latest release](https://github.com/aarondpn/redmine_pull_requests/releases/latest) into Redmine's `plugins` directory (or clone it there as `redmine_pull_requests`) and run the migrations:

```sh
cd /path/to/redmine
tar xzf redmine_pull_requests-vX.Y.Z.tar.gz -C plugins
# or: git clone https://github.com/aarondpn/redmine_pull_requests.git plugins/redmine_pull_requests
bundle exec rake redmine:plugins:migrate RAILS_ENV=production
bundle exec rake assets:precompile RAILS_ENV=production   # Redmine 6.0 and newer
```

The plugin directory must be named `redmine_pull_requests` (the release archives already contain it). On Redmine 6.0+, skipping `assets:precompile` leaves the panel unstyled and its rows can't be expanded. Restart Redmine, then:

1. Configure the plugin in *Administration » Plugins » Pull Requests » Configure*.
2. Grant **View pull requests**, **Manage pull requests** and **Manage pull request settings** to your roles in *Administration » Roles and permissions*.
3. Enable the **Pull requests** module in a project and list its [allowed repositories](#allowed-repositories). Until then nothing can be linked there.

Release archives come with a [build provenance attestation](https://docs.github.com/actions/security-for-github-actions/using-artifact-attestations): `gh attestation verify redmine_pull_requests-vX.Y.Z.tar.gz -R aarondpn/redmine_pull_requests`.

**Upgrading**: replace the plugin directory (or `git pull`), run `redmine:plugins:migrate` and (Redmine 6.0+) `assets:precompile` as above and restart. See the [changelog](CHANGELOG.md) for version-specific steps.

### Uninstalling

```sh
bundle exec rake redmine:plugins:migrate NAME=redmine_pull_requests VERSION=0 RAILS_ENV=production
rm -r plugins/redmine_pull_requests
```

This drops the plugin's tables. Restart Redmine afterwards. To also remove the module entries, settings and published assets that Redmine keeps:

```sh
bundle exec rails runner -e production "EnabledModule.where(name: 'pull_requests').delete_all; Setting.where(name: 'plugin_redmine_pull_requests').delete_all"
rm -rf public/plugin_assets/redmine_pull_requests public/assets/plugin_assets/redmine_pull_requests
```

## Configuration

GitHub and GitLab each have their own section in the plugin settings:

| Setting | Description |
| --- | --- |
| URL / API URL | GitHub: `https://github.com`, `https://api.github.com` (Enterprise: `https://github.example.com/api/v3`). GitLab: `https://gitlab.com`, `https://gitlab.com/api/v4`, self-managed also under a path. |
| Access token | Needed for private repositories and to update reviews and checks from webhooks. Env: `REDMINE_PR_GITHUB_TOKEN` / `REDMINE_PR_GITLAB_TOKEN`. |
| Webhook secret | Required for webhooks. Env: `REDMINE_PR_GITHUB_WEBHOOK_SECRET` / `REDMINE_PR_GITLAB_WEBHOOK_SECRET`. |

Stored tokens and secrets are never shown and are filtered from the log; leave a field blank to keep it or tick *Remove* to clear it. Environment variables keep them out of the database. Further options: link plain `#123` references (otherwise only `refs #123`, `fixes #123`), link by branch name (`123-login`, `feature/123-login`, `issue-123`) and apply Redmine's fixing keywords on merge.

### Access tokens

The plugin only reads from GitHub and GitLab.

- **GitHub, classic token**: `repo` scope for private repositories, none for public ones.
- **GitHub, fine-grained token**: *Pull requests* and *Commit statuses*, read-only. These can't load check runs (e.g. GitHub Actions) on private repositories; use a classic token if you need them.
- **GitLab**: personal, group or project token with `read_api`.

Without a token GitHub allows only 60 requests per hour. Unresolved threads on GitHub always need a token (GraphQL). Details a token can't load (reviews, checks, threads, GitLab commit counts) are left out and the error is logged, so check the token first when checks don't show up.

### Allowed repositories

In *Project » Settings » Pull requests*, one pattern per line, case-insensitive, lines starting with `#` are ignored:

- `acme/web`: this repository, on GitHub and GitLab
- `acme/*`: all repositories of `acme` (one level)
- `acme/**`: the GitLab group `acme`, including subgroups
- `github:acme/web`, `gitlab:acme/**`: one provider only

Webhooks, manual links, fixing keywords and the API only reach issues in projects that allow the repository, which protects against untrusted repositories such as forks. Subprojects don't inherit the list.

> [!IMPORTANT]
> *Manage pull requests* lets a user load any pull request of the allowed repositories with the configured token, and *Manage pull request settings* decides which repositories those are. Limit the token to the repositories that belong in Redmine. The allow-list relies on the webhook secret, one per provider: whoever knows it can send events for any repository, so treat it like a password and only add the webhook to repositories and organizations whose admins you trust.

### Webhooks

| | GitHub | GitLab |
| --- | --- | --- |
| URL | `https://redmine.example.com/pull_requests/github/webhook` | `https://redmine.example.com/pull_requests/gitlab/webhook` |
| Content type | `application/json` | – |
| Secret | GitHub webhook secret | *Secret token*: GitLab webhook secret |
| Required events | *Pull requests* | *Merge request events* |
| Optional events, to keep reviews and checks up to date | *Pull request reviews*, *Pull request review comments*, *Pull request review threads*, *Issue comments*, *Check runs*, *Check suites*, *Statuses* | *Comments*, *Pipeline events* |

Add it to a repository or organization on GitHub, a project or (Premium and Ultimate) group on GitLab under *Settings » Webhooks*. Issues are linked when a pull request is opened, edited, reopened or marked ready, also by full issue URL if it matches *Host name and path* in *Administration » Settings » General*. Links you remove by hand are not re-added. Fixing keywords are applied once on merge, recorded as *Anonymous*.

Since payloads lack reviews and checks, the plugin reloads them from the API in a background job (ActiveJob, inside the Redmine process unless another queue adapter is configured) when a token is configured; without a token, use *Refresh*.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for running the tests and releasing, and [SECURITY.md](SECURITY.md) for reporting vulnerabilities.

## License

[MIT](LICENSE). Icons are [GitHub Octicons](https://github.com/primer/octicons) (MIT) and the GitLab logo from [Simple Icons](https://simpleicons.org) (CC0).
