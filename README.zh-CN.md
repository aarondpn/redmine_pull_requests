<p align="center">
  <img src="docs/logo.svg" alt="redmine_pull_requests 标志" width="120" />
</p>

<h1 align="center">Redmine Pull Requests</h1>

<p align="center">
  将 GitHub 拉取请求（Pull Request）和 GitLab 合并请求（Merge Request）关联到 <a href="https://www.redmine.org/">Redmine</a> 问题，并直接在问题页面上查看它们的状态、审查和检查。
</p>

<p align="center">
  <a href="README.md">English</a> ·
  <b>简体中文</b> ·
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
  <a href="#安装">安装</a> ·
  <a href="#配置">配置</a> ·
  <a href="#webhook">Webhook</a> ·
  <a href="API.md">REST API</a>
</p>

![Redmine 问题上的拉取请求](docs/hero.png)

## 功能

- **GitHub 和 GitLab** 同时支持，包括 GitHub Enterprise、自托管 GitLab 和子群组
- **多对多**：一个问题可关联多个拉取请求，一个拉取请求也可以关联到多个问题
- **实时详情**：状态、作者、分支、差异统计、审查者和审查结论、CI 检查或流水线、评论和未解决的讨论
- **通过 URL 关联**，或通过 **Webhook** 根据标题、描述或分支名称中的 `#123` 自动关联
- **用于解决问题的关键字**：合并一个写有 `Fixes #123` 的拉取请求会解决该问题，就像提交一样
- **按项目设置允许的仓库**，关联只会作用于信任该仓库的项目
- **[REST API](API.md)**（英文），按角色分配权限，已翻译为 8 种语言

![关联拉取请求并展开详情](docs/demo.gif)

<table>
  <tr>
    <td width="50%"><img src="docs/details.png" alt="显示审查者、审查结论、检查、评论和未解决讨论的拉取请求"></td>
    <td width="50%"><img src="docs/compact.png" alt="包含 GitHub 拉取请求和一个 GitLab 合并请求的紧凑列表"></td>
  </tr>
</table>

## 安装

Redmine 5.0 至 7.0（CI 中针对 5.1、6.1 和 7.0 进行测试），Ruby 2.7 或更高版本，不需要额外的 gem。

将[最新发布](https://github.com/aarondpn/redmine_pull_requests/releases/latest)解压到 Redmine 的 `plugins` 目录（或以 `redmine_pull_requests` 为名克隆到该目录），然后运行数据库迁移：

```sh
cd /path/to/redmine
tar xzf redmine_pull_requests-vX.Y.Z.tar.gz -C plugins
# or: git clone https://github.com/aarondpn/redmine_pull_requests.git plugins/redmine_pull_requests
bundle exec rake redmine:plugins:migrate RAILS_ENV=production
bundle exec rake assets:precompile RAILS_ENV=production   # Redmine 6.0 and newer
```

插件目录必须命名为 `redmine_pull_requests`（发布包中已经是这个名称）。在 Redmine 6.0+ 上，如果跳过 `assets:precompile`，面板将没有样式，行也无法展开。重启 Redmine，然后：

1. 在 *管理 » 插件 » Pull Requests » 配置* 中配置插件。
2. 在 *管理 » 角色和权限* 中为角色授予 **查看拉取请求**、**管理拉取请求** 和 **管理拉取请求配置** 权限。
3. 在项目中启用 **拉取请求** 模块，并列出该项目[允许的仓库](#允许的仓库)。在此之前，该项目中无法关联任何内容。

发布包附带[构建来源证明（build provenance attestation）](https://docs.github.com/actions/security-for-github-actions/using-artifact-attestations)：`gh attestation verify redmine_pull_requests-vX.Y.Z.tar.gz -R aarondpn/redmine_pull_requests`。

**升级**：替换插件目录（或执行 `git pull`），按上文运行 `redmine:plugins:migrate` 和（Redmine 6.0+）`assets:precompile`，然后重启。特定版本需要的步骤请参见[更新日志](CHANGELOG.md)。

### 卸载

```sh
bundle exec rake redmine:plugins:migrate NAME=redmine_pull_requests VERSION=0 RAILS_ENV=production
rm -r plugins/redmine_pull_requests
```

这会删除插件的数据表。之后请重启 Redmine。如需一并删除 Redmine 保留的模块条目、配置和已发布的静态资源：

```sh
bundle exec rails runner -e production "EnabledModule.where(name: 'pull_requests').delete_all; Setting.where(name: 'plugin_redmine_pull_requests').delete_all"
rm -rf public/plugin_assets/redmine_pull_requests public/assets/plugin_assets/redmine_pull_requests
```

## 配置

GitHub 和 GitLab 在插件配置中各有独立的部分：

| 配置项 | 说明 |
| --- | --- |
| URL / API URL | GitHub：`https://github.com`、`https://api.github.com`（Enterprise：`https://github.example.com/api/v3`）。GitLab：`https://gitlab.com`、`https://gitlab.com/api/v4`，自托管实例也可以位于子路径下。 |
| 访问令牌 | 私有仓库以及通过 Webhook 更新审查和检查时需要。环境变量：`REDMINE_PR_GITHUB_TOKEN` / `REDMINE_PR_GITLAB_TOKEN`。 |
| Webhook 密钥 | Webhook 必须配置此项。环境变量：`REDMINE_PR_GITHUB_WEBHOOK_SECRET` / `REDMINE_PR_GITLAB_WEBHOOK_SECRET`。 |

已保存的令牌和密钥不会显示，并会从日志中过滤掉；字段留空即保留已保存的值，勾选 *删除* 则清除该值。通过环境变量设置时，它们不会存入数据库。其他选项：关联不带关键字的 `#123` 引用（否则只关联 `refs #123`、`fixes #123`）、按分支名称关联（`123-login`、`feature/123-login`、`issue-123`），以及合并时应用 Redmine 的“用于解决问题的关键字”。

### 访问令牌

插件只会从 GitHub 和 GitLab 读取数据。

- **GitHub 经典令牌**：私有仓库需要 `repo` 范围，公开仓库不需要任何范围。
- **GitHub 细粒度令牌**：*Pull requests* 和 *Commit statuses*，均为只读。这类令牌无法在私有仓库上加载检查运行（例如 GitHub Actions）；如果需要，请使用经典令牌。
- **GitLab**：具有 `read_api` 范围的个人、群组或项目令牌。

没有令牌时，GitHub 每小时只允许 60 次请求。GitHub 上的未解决讨论始终需要令牌（GraphQL）。令牌无法加载的详情（审查、检查、讨论、GitLab 提交数）会被省略，错误会写入日志，因此检查结果不显示时，请先检查令牌。

### 允许的仓库

在 *项目 » 配置 » 拉取请求* 中设置，每行一个模式，不区分大小写，以 `#` 开头的行会被忽略：

- `acme/web`：该仓库，GitHub 和 GitLab 上均适用
- `acme/*`：`acme` 下的所有仓库（仅一级）
- `acme/**`：GitLab 群组 `acme`，包括子群组
- `github:acme/web`、`gitlab:acme/**`：仅适用于一个平台

Webhook、手动关联、用于解决问题的关键字和 API 只会作用于允许该仓库的项目中的问题，从而防止来自不受信任的仓库（例如复刻）的关联。子项目不会继承该列表。

> [!IMPORTANT]
> 拥有 *管理拉取请求* 权限的用户可以使用已配置的令牌加载允许的仓库中的任意拉取请求，而 *管理拉取请求配置* 权限决定允许哪些仓库。请将令牌的访问范围限制在应当接入 Redmine 的仓库。允许列表依赖于 Webhook 密钥，每个平台一个：知道密钥的人可以以任意仓库的名义发送事件，因此请像对待密码一样对待它，并且只在你信任其管理员的仓库和组织中添加 Webhook。

### Webhook

| | GitHub | GitLab |
| --- | --- | --- |
| URL | `https://redmine.example.com/pull_requests/github/webhook` | `https://redmine.example.com/pull_requests/gitlab/webhook` |
| Content type | `application/json` | – |
| Secret | GitHub Webhook 密钥 | *Secret token*：GitLab Webhook 密钥 |
| 必需的事件 | *Pull requests* | *Merge request events* |
| 可选事件，用于保持审查和检查为最新状态 | *Pull request reviews*、*Pull request review comments*、*Pull request review threads*、*Issue comments*、*Check runs*、*Check suites*、*Statuses* | *Comments*、*Pipeline events* |

在 GitHub 上将其添加到仓库或组织，在 GitLab 上添加到项目或群组（Premium 和 Ultimate），位置为 *Settings » Webhooks*。拉取请求被打开、编辑、重新打开或标记为可供审查时会关联问题；如果完整的问题 URL 与 *管理 » 配置 » 一般* 中的 *主机名称* 匹配，也可以通过它关联。手动删除的关联不会被重新添加。用于解决问题的关键字在合并时应用一次，记录为由 *匿名用户* 执行。

由于负载中不包含审查和检查，配置令牌后，插件会在后台任务中通过 API 重新加载它们（ActiveJob，除非配置了其他队列适配器，否则在 Redmine 进程内运行）；没有令牌时，请使用 *从 GitHub/GitLab 刷新*。

## 贡献

关于运行测试和发布，请参见 [CONTRIBUTING.md](CONTRIBUTING.md)（英文）；关于报告安全漏洞，请参见 [SECURITY.md](SECURITY.md)。

## 许可证

[MIT](LICENSE)。图标来自 [GitHub Octicons](https://github.com/primer/octicons)（MIT），GitLab 标志来自 [Simple Icons](https://simpleicons.org)（CC0）。
