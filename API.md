# REST API

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

`{"pull_request": {"url": "..."}}` links a single URL, at most 20 URLs per request. Linking is idempotent. If one of the URLs is invalid, not [allowed in the project](README.md#allowed-repositories) or can't be loaded, nothing is stored and the response is `422` with the reasons:

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
