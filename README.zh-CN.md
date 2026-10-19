# Redmine Pull Requests

[English](README.md) | **简体中文** | [日本語](README.ja.md) | [Español](README.es.md)

[![E2E](https://github.com/aarondpn/redmine_pull_requests/actions/workflows/e2e.yml/badge.svg)](https://github.com/aarondpn/redmine_pull_requests/actions/workflows/e2e.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
![Redmine 5.0 – 7.0](https://img.shields.io/badge/Redmine-5.0%20%E2%80%93%207.0-b32024)

将 GitHub 拉取请求（Pull Request）和 GitLab 合并请求（Merge Request）关联到 Redmine 问题，并直接在问题页面上以 GitHub 风格查看它们的状态、审查和检查。

![Redmine 问题上的拉取请求](docs/hero.png)

## 功能

- **一个问题可关联多个拉取请求**，一个拉取请求也可以关联到多个问题
- **同时支持 GitHub 和 GitLab**，包括 GitHub Enterprise、自托管 GitLab 和 GitLab 子群组
- **实时状态**：打开、草稿、已合并和已关闭，并显示作者、分支、提交和差异统计
- **审查详情**：审查者及其审查状态，已批准 / 已请求更改 / 需要审查，CI 检查或 GitLab 流水线，评论和未解决的讨论
- **紧凑列表**：问题关联多个拉取请求时以列表显示，每一行都可展开查看完整详情
- **通过 URL 关联**：粘贴一个或多个拉取请求/合并请求的 URL
- **按项目设置允许的仓库**，Webhook 和关联只会作用于信任该仓库的项目
- **Webhook**：根据标题、描述或分支名称中的 `#123` 自动关联，实时更新状态、审查和检查
- **用于解决问题的关键字**：合并一个写有 `Fixes #123` 的拉取请求会解决该问题，就像提交一样
- **REST API**：可在脚本和 CI 中列出、关联、刷新和取消关联拉取请求
- 按角色分配权限，支持 Redmine 5.0 至 7.0
- **多语言**：英语、德语、法语、西班牙语、日语、简体中文、波兰语和俄语

### 实际效果

![关联拉取请求并展开详情](docs/demo.gif)

<table>
  <tr>
    <td width="50%"><img src="docs/details.png" alt="显示审查者、审查结论、检查、评论和未解决讨论的拉取请求"></td>
    <td width="50%"><img src="docs/compact.png" alt="包含 GitHub 拉取请求和一个 GitLab 合并请求的紧凑列表"></td>
  </tr>
  <tr>
    <td><b>一目了然</b><br>审查者及其审查状态、审查结论、检查、评论和未解决的讨论。</td>
    <td><b>数量多时自动紧凑</b><br>多个拉取请求折叠为列表，GitHub 和 GitLab 并列显示。</td>
  </tr>
  <tr>
    <td width="50%"><img src="docs/link.png" alt="通过粘贴 URL 关联拉取请求"></td>
    <td width="50%"><img src="docs/webhook.png" alt="拉取请求合并后问题被自动解决"></td>
  </tr>
  <tr>
    <td><b>通过 URL 关联</b><br>粘贴一个或多个拉取请求或合并请求的 URL，详情会从 API 加载。</td>
    <td><b>合并即解决</b><br>写有 <code>Fixes #123</code> 的拉取请求合并后会解决该问题，通过 Webhook 关联。</td>
  </tr>
</table>

## 兼容性

| Redmine | Rails | CI 中测试的版本 |
| --- | --- | --- |
| 7.0 | 8.1 | 7.0 |
| 6.0, 6.1 | 7.2 | 6.1 |
| 5.0, 5.1 | 6.1 | 5.1 |

每次变更都会针对每个主版本的最新次版本进行端到端测试，分别以绑定挂载的代码检出和从发布包安装两种方式运行。插件不需要额外的 gem。插件需要 Ruby 2.7 或更高版本，这只对 Redmine 5.0 有影响：该版本仍允许使用 Ruby 2.5 和 2.6。

## 安装

从[最新发布](https://github.com/aarondpn/redmine_pull_requests/releases/latest)下载 `redmine_pull_requests-vX.Y.Z.tar.gz`，解压到 Redmine 的 `plugins` 目录（或将仓库克隆到该目录），然后运行数据库迁移。在 Redmine 6.0 及更高版本上，还需要预编译静态资源：

```sh
cd /path/to/redmine
tar xzf redmine_pull_requests-vX.Y.Z.tar.gz -C plugins
# or: git clone https://github.com/aarondpn/redmine_pull_requests.git plugins/redmine_pull_requests
bundle exec rake redmine:plugins:migrate RAILS_ENV=production
bundle exec rake assets:precompile RAILS_ENV=production   # Redmine 6.0 and newer
```

插件目录必须命名为 `redmine_pull_requests`（发布包中已经是这个名称）。Redmine 6.0+ 只有在某个静态资源文件比上次构建更新时才会自动重新构建，而发布包中文件的时间是发布日期。如果不运行 `assets:precompile`，插件的样式表和脚本会返回 404，面板将没有样式，行也无法展开。

重启 Redmine，然后：

1. 在 *管理 » 插件 » Pull Requests » 配置* 中配置插件。
2. 为角色授予 **查看拉取请求**、**管理拉取请求** 和 **管理拉取请求配置** 权限（*管理 » 角色和权限*）。
3. 在项目配置中启用 **拉取请求** 模块，并在 *项目 » 配置 » 拉取请求* 中列出该项目的仓库（参见[允许的仓库](#允许的仓库)）。在此之前，该项目中无法关联任何内容。

发布包附带[构建来源证明（build provenance attestation）](https://docs.github.com/actions/security-for-github-actions/using-artifact-attestations)。可以用 `gh attestation verify redmine_pull_requests-vX.Y.Z.tar.gz -R aarondpn/redmine_pull_requests` 验证下载的文件。

### 升级

用新版本替换插件目录（或执行 `git pull`），运行 `bundle exec rake redmine:plugins:migrate RAILS_ENV=production`，在 Redmine 6.0 及更高版本上再运行 `bundle exec rake assets:precompile RAILS_ENV=production`，然后重启 Redmine。请查看[更新日志](CHANGELOG.md)，了解特定版本需要的额外步骤。

### 卸载

```sh
bundle exec rake redmine:plugins:migrate NAME=redmine_pull_requests VERSION=0 RAILS_ENV=production
rm -r plugins/redmine_pull_requests
```

这会删除插件的数据表。之后请重启 Redmine。

Redmine 会保留一些无害的内容：项目中的 *拉取请求* 模块条目、插件配置，以及发布到 `public/plugin_assets/redmine_pull_requests`（Redmine 5）或 `public/assets/plugin_assets/redmine_pull_requests`（Redmine 6.0+）的静态资源。如需一并删除：

```sh
bundle exec rails runner -e production "EnabledModule.where(name: 'pull_requests').delete_all; Setting.where(name: 'plugin_redmine_pull_requests').delete_all"
rm -rf public/plugin_assets/redmine_pull_requests public/assets/plugin_assets/redmine_pull_requests
```

## 配置

GitHub 和 GitLab 在插件配置中各有独立的部分：

| 配置项 | 说明 |
| --- | --- |
| URL / API URL | GitHub：`https://github.com`、`https://api.github.com`（Enterprise：`https://github.example.com/api/v3`）。GitLab：`https://gitlab.com`、`https://gitlab.com/api/v4`，自托管实例也可以位于子路径下，如 `https://example.com/gitlab`。 |
| 访问令牌 | 参见[访问令牌](#访问令牌)。私有仓库以及通过 Webhook 更新审查和检查时需要。可通过 `REDMINE_PR_GITHUB_TOKEN` / `REDMINE_PR_GITLAB_TOKEN` 设置。 |
| Webhook 密钥 | Webhook 必须配置此项。可通过 `REDMINE_PR_GITHUB_WEBHOOK_SECRET` / `REDMINE_PR_GITLAB_WEBHOOK_SECRET` 设置。 |

已保存的令牌和密钥不会显示在配置页面上。字段留空即保留已保存的值，勾选 *删除* 则清除该值。它们会从 Rails 日志中过滤掉；通过 `REDMINE_PR_*` 环境变量设置时，它们也不会存入数据库。

通用的关联选项：

| 配置项 | 说明 |
| --- | --- |
| 关联不带关键字的 `#123` 引用 | 否则只关联带有 Redmine 提交关键字的引用（`refs #123`、`fixes #123`）。 |
| 按分支名称关联 | 关联 `123-login`、`feature/123-login` 或 `issue-123` 这样的分支。 |
| 合并时应用“用于解决问题的关键字” | 使用 *管理 » 配置 » 版本库* 中的 *用于解决问题的关键字*。 |

### 允许的仓库

每个项目在 *项目 » 配置 » 拉取请求* 中决定哪些仓库可以关联到它的问题（需要 *管理拉取请求配置* 权限并已启用该模块）。每行一个模式，不区分大小写：

- `acme/web`：该仓库，GitHub 和 GitLab 上均适用
- `acme/*`：`acme` 下的所有仓库（仅一级）
- `acme/**`：GitLab 群组 `acme` 下的所有项目，包括子群组
- `github:acme/web` 或 `gitlab:acme/**`：仅适用于一个平台的模式

空行和以 `#` 开头的行会被忽略。Webhook 只会在允许该拉取请求所属仓库的项目中关联问题和应用用于解决问题的关键字；对其他项目中问题的引用会被忽略。手动关联和 REST API 也只接受允许的仓库。项目的列表为空时，该项目中无法关联任何内容；已经关联的拉取请求仍然可见。子项目不会继承该列表。

在项目中拥有 *管理拉取请求* 权限的任何人，都可以使用已配置的访问令牌加载该项目允许的仓库中的任意拉取请求；拥有 *管理拉取请求配置* 权限的任何人，都可以更改允许哪些仓库。请像其他项目配置权限一样谨慎授予该权限，并将令牌的访问范围限制在应当接入 Redmine 的仓库。

允许列表可以防止项目接收来自其不信任的仓库（例如公开仓库的复刻）的拉取请求。它依赖于 Webhook 密钥：每个平台只有一个密钥，知道密钥的人可以以任意仓库的名义发送事件。请像对待密码一样对待这些密钥，并且只在你信任其管理员的仓库和组织中添加 Webhook。

### 访问令牌

插件只会从 GitHub 和 GitLab 读取数据。

- **GitHub 细粒度令牌**：仓库权限（Repository permissions）*Pull requests* 和 *Commit statuses*，均为只读（*Metadata* 只读权限会自动添加）。GitHub 不为细粒度令牌提供 *Checks* 权限，因此在私有仓库上，这类令牌无法加载检查运行（例如 GitHub Actions）。如果需要，请使用经典令牌。
- **GitHub 经典令牌**：私有仓库需要 `repo` 范围，包括检查运行。公开仓库不需要任何范围。
- **GitLab**：具有 `read_api` 范围的个人、群组或项目访问令牌。

公开仓库无需令牌也能使用，但此时 GitHub 每小时只允许 60 次请求。如果令牌缺少某项权限，插件会省略无法加载的详情（审查、检查、未解决的讨论、GitLab 提交数），并且只会将错误写入 Redmine 日志。检查结果不显示时，请先检查令牌的权限。

### GitHub Webhook

在仓库或组织设置中添加一个 Webhook：

- **Payload URL**：`https://redmine.example.com/pull_requests/github/webhook`
- **Content type**：`application/json`
- **Secret**：插件配置中的 GitHub Webhook 密钥
- **事件**：*Pull requests*，另外勾选 *Pull request reviews*、*Pull request review comments*、*Pull request review threads*、*Issue comments*、*Check runs*、*Check suites* 和 *Statuses*，以保持审查和检查为最新状态

### GitLab Webhook

在项目设置中（GitLab Premium 和 Ultimate 也可以在群组设置中，*设置 » Webhooks*）添加一个 Webhook：

- **URL**：`https://redmine.example.com/pull_requests/gitlab/webhook`
- **Secret 令牌**（Secret token）：插件配置中的 GitLab Webhook 密钥
- **触发器**：*合并请求事件*（Merge request events），另外勾选 *评论*（Comments）和 *流水线事件*（Pipeline events），以保持讨论和流水线为最新状态

Webhook 负载中不包含审查、检查，（在 GitLab 上）也不包含作者和提交数。配置访问令牌后，插件会在后台任务中通过 API 重新加载这些信息（Rails ActiveJob，除非配置了其他队列适配器，否则它在 Redmine 进程内运行），因此 Webhook 投递会立即得到响应。该任务会在几秒后启动，在此之前到达的同一拉取请求的投递都由这一次重新加载处理。如果没有令牌，这些信息只会在你点击 *从 GitHub/GitLab 刷新* 时更新。GitHub 上未解决的审查讨论来自 GraphQL API，需要令牌。

### 关联

Webhook 会保持已关联的拉取请求/合并请求为最新状态。拉取请求被打开、编辑、重新打开或标记为可供审查时，会关联其中引用的问题，前提是问题所属项目已启用该模块并且[允许该仓库](#允许的仓库)。在 GitLab 上，只有修改标题、描述或草稿状态的编辑才会关联问题，推送、标签、指派人或审查者的变化不会。每个事件最多处理 50 个引用。手动删除的关联不会因之后的推送而重新添加。`release/2024-10`、`v2.3.1` 或 `2024-q3` 这样的分支名称不会关联问题。如果完整 URL（例如 `https://redmine.example.com/issues/123`）与 *管理 » 配置 » 一般* 中的 *主机名称* 匹配，问题也可以通过完整 URL 识别。

用于解决问题的关键字对每个拉取请求只应用一次，在合并事件到达时应用。由这些关键字引起的状态变更会记录为由 *匿名用户* 执行，与 Redmine 自身处理无法映射到用户的提交者的提交时的做法相同。

## REST API

需要在 *管理 » 配置 » API*（Redmine 7.0 中为 *管理 » 配置 » Integrations*）中勾选 *启用REST web service*。认证方式和状态码与 Redmine 其他 API 相同（`X-Redmine-API-Key` 请求头，`.json` 或 `.xml`）。读取需要 *查看拉取请求* 权限，其他所有端点需要 *管理拉取请求* 权限。

| 方法 | 路径 | |
| --- | --- | --- |
| `GET` | `/issues/:issue_id/pull_requests.json` | 关联到该问题的拉取请求 |
| `GET` | `/issues/:issue_id/pull_requests/:id.json` | 单个拉取请求 |
| `POST` | `/issues/:issue_id/pull_requests.json` | 通过 URL 关联拉取请求/合并请求，返回 `201` 和已关联的拉取请求 |
| `POST` | `/issues/:issue_id/pull_requests/:id/refresh.json` | 从 GitHub/GitLab 重新加载 |
| `DELETE` | `/issues/:issue_id/pull_requests/:id.json` | 取消关联，返回 `204` |

```sh
curl -X POST https://redmine.example.com/issues/123/pull_requests.json \
  -H "X-Redmine-API-Key: $REDMINE_API_KEY" -H "Content-Type: application/json" \
  -d '{"pull_request": {"urls": ["https://github.com/acme/web/pull/42",
                                 "https://gitlab.com/acme/platform/web/-/merge_requests/7"]}}'
```

`{"pull_request": {"url": "..."}}` 用于关联单个 URL，每次请求最多 20 个 URL。关联操作是幂等的。如果其中某个 URL 无效、不在[项目允许的范围内](#允许的仓库)或无法加载，则不会保存任何内容，并返回 `422` 及原因。错误消息使用 API 用户的语言，例如简体中文：

```json
{"errors": ["acme/secret 不在本项目允许的仓库中（项目配置 › 拉取请求）。", "无法从 GitHub 加载 acme/web#9999（404 Not Found）。"]}
```

一个拉取请求的结构如下（已简化）：

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

未知的值为 `null`，但 `author`、`merged_by`、`checks` 和 `linked_by` 除外，它们在未知时会被省略：`merged_by` 只出现在已合并的拉取请求中，`checks` 在存在检查或流水线后才出现，`linked_by` 只出现在由用户（而非 Webhook）创建的关联中。`merged_on` 和 `closed_on` 始终存在，在拉取请求处于打开状态时为 `null`。

- `state`：`open`、`merged` 或 `closed`。`status` 还会区分 `draft`。
- `review_decision`：`approved`、`changes_requested`、`review_required` 或 `null`。
- 审查者的 `state`：`approved`、`changes_requested`、`commented` 或 `pending`。
- `checks.state`：`success`、`failure`、`pending` 或 `neutral`。在 GitLab 上这是流水线状态，`total`、`passed` 和 `failed` 为 `null`。
- `link_source`：`manual`（界面/API）或 `webhook`。

## 开发

E2E 测试使用 Docker 启动 Redmine 和模拟的 GitHub/GitLab API，并通过 [Playwright](https://playwright.dev) 运行：

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

设置 `E2E_SKIP_STACK=1` 可复用一个正在运行且已填充数据的环境。

测试期间 Redmine 运行在 http://localhost:3000（使用 `admin` / `admin12345` 登录，或使用 `manager`、`dev`、`reporter` 加密码 `password123` 登录）。如需使用其他端口，请同时设置 `REDMINE_PORT`、`MOCK_API_PORT` 以及 `REDMINE_URL`、`MOCK_API_URL`。

## 发布

1. 更新 `init.rb` 中的 `version`，并在 `CHANGELOG.md` 中为该版本添加一节。
2. 提交，然后打标签并推送：`git tag v1.2.3 && git push origin v1.2.3`。

发布工作流会在打标签的提交上运行 E2E 测试，检查标签是否与 `init.rb` 一致，构建发布包，并以更新日志中对应的一节作为说明发布 GitHub Release。带有后缀的标签（如 `v1.3.0-rc.1`）会作为预发布版本发布，不会成为最新发布。

## 安全

关于如何报告安全漏洞，请参见 [SECURITY.md](SECURITY.md)。

## 许可证

[MIT](LICENSE)

## 致谢

图标来自 [GitHub Octicons](https://github.com/primer/octicons)（MIT），GitLab 标志来自 [Simple Icons](https://simpleicons.org)（CC0）。
