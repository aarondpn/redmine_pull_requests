import { createHmac } from 'node:crypto'
import { expect } from '@playwright/test'

export const ADMIN_API_KEY = 'e2e0000000000000000000000000000000000000'
export const API_KEYS = {
  admin: ADMIN_API_KEY,
  dev: 'e2e1000000000000000000000000000000000000',
  reporter: 'e2e2000000000000000000000000000000000000',
  manager: 'e2e3000000000000000000000000000000000000',
}
export const WEBHOOK_SECRET = 'e2e-webhook-secret'
export const GITLAB_WEBHOOK_SECRET = 'e2e-gitlab-secret'
export const MOCK_API_URL = process.env.MOCK_API_URL || 'http://localhost:4010'

export const USERS = {
  admin: { login: 'admin', password: 'admin12345' },
  dev: { login: 'dev', password: 'password123' },
  reporter: { login: 'reporter', password: 'password123' },
  manager: { login: 'manager', password: 'password123' },
}

// Pull request numbers that are new on every run, e.g. for merges (fixing
// keywords are only applied once per pull request)
let lastNumber = 0
export function uniqueNumber() {
  lastNumber = Math.max(lastNumber + 1, Math.floor(Date.now() / 100) % 1_000_000_000)
  return lastNumber
}

// Reloads the page until the assertion passes, e.g. after a webhook queued
// a refresh in the background
export async function reloadUntil(page, assertion, timeout = 15_000) {
  await expect(async () => {
    await page.reload()
    await assertion()
  }).toPass({ timeout, intervals: [250, 500, 1000] })
}

export async function login(page, user = USERS.admin) {
  await page.goto('/login')
  await page.locator('#username').fill(user.login)
  await page.locator('#password').fill(user.password)
  await page.locator('#login-submit').click()
  await expect(page).not.toHaveURL(/\/login/)
}

export async function createIssue(request, { project = 'acme', subject, description = '' } = {}) {
  const response = await request.post('/issues.json', {
    headers: { 'X-Redmine-API-Key': ADMIN_API_KEY },
    data: { issue: { project_id: project, subject: subject || `E2E issue ${Date.now()}`, description } },
  })
  expect(response.status()).toBe(201)
  return (await response.json()).issue
}

export async function getIssue(request, id) {
  const response = await request.get(`/issues/${id}.json`, { headers: { 'X-Redmine-API-Key': ADMIN_API_KEY } })
  expect(response.ok()).toBeTruthy()
  return (await response.json()).issue
}

export async function resetMockApi(request) {
  await request.post(`${MOCK_API_URL}/__reset`)
}

export async function updateGithubPullRequest(request, reference, attrs) {
  const [repo, number] = reference.split('#')
  const response = await request.put(`${MOCK_API_URL}/__fixtures/github/${repo}/${number}`, { data: attrs })
  expect(response.ok()).toBeTruthy()
  return response.json()
}

export async function updateGitlabMergeRequest(request, reference, attrs) {
  const [project, iid] = reference.split('!')
  const response = await request.put(`${MOCK_API_URL}/__fixtures/gitlab/${project}/${iid}`, { data: attrs })
  expect(response.ok()).toBeTruthy()
  return response.json()
}

export async function sendWebhook(request, payload, { secret = WEBHOOK_SECRET, event = 'pull_request' } = {}) {
  const body = JSON.stringify(payload)
  const signature = 'sha256=' + createHmac('sha256', secret).update(body).digest('hex')
  return request.post('/pull_requests/github/webhook', {
    headers: { 'Content-Type': 'application/json', 'X-GitHub-Event': event, 'X-Hub-Signature-256': signature },
    data: body,
  })
}

export async function sendGitlabWebhook(request, payload, { token = GITLAB_WEBHOOK_SECRET, event = 'Merge Request Hook' } = {}) {
  return request.post('/pull_requests/gitlab/webhook', {
    headers: { 'Content-Type': 'application/json', 'X-Gitlab-Event': event, 'X-Gitlab-Token': token },
    data: JSON.stringify(payload),
  })
}

export function mergeRequestPayload(action, { project = 'acme/platform/web', iid, title, description = '', branch = 'feature-x', state = 'opened', draft = false, user = 'tanuki', oldrev, changes } = {}) {
  const now = new Date().toISOString().replace('T', ' ').replace(/\.\d+Z$/, ' UTC')
  return {
    object_kind: 'merge_request',
    event_type: 'merge_request',
    user: { username: user, name: user, avatar_url: `${MOCK_API_URL}/avatars/${user}.svg` },
    project: { path_with_namespace: project, web_url: `https://gitlab.com/${project}` },
    object_attributes: {
      iid,
      action,
      title,
      description,
      state,
      draft,
      source_branch: branch,
      target_branch: 'main',
      url: `https://gitlab.com/${project}/-/merge_requests/${iid}`,
      created_at: now,
      updated_at: now,
      ...(oldrev ? { oldrev } : {}),
    },
    ...(changes ? { changes } : {}),
  }
}

export function pullRequestPayload(action, { repo = 'acme/web', number, title, body = '', branch = 'feature/x', merged = false, state = 'open', draft = false } = {}) {
  const now = new Date().toISOString()
  return {
    action,
    number,
    repository: { full_name: repo },
    pull_request: {
      html_url: `https://github.com/${repo}/pull/${number}`,
      number,
      title,
      body,
      state,
      draft,
      merged,
      user: { login: 'octocat', avatar_url: `${MOCK_API_URL}/avatars/octocat.svg` },
      merged_by: merged ? { login: 'monalisa' } : null,
      created_at: now,
      merged_at: merged ? now : null,
      closed_at: state === 'closed' ? now : null,
      head: { ref: branch, sha: `${repo.replace('/', '-')}-${number}-sha` },
      base: { ref: 'main', repo: { full_name: repo } },
      commits: 2,
      additions: 25,
      deletions: 4,
      changed_files: 2,
    },
  }
}

export function panel(page) {
  return page.locator('#pull-requests')
}

export async function linkPullRequests(page, urls) {
  const form = page.locator('#new-pull-request-form')
  // by data attribute and type, the screenshots are also taken in other languages
  if (!(await form.isVisible())) await panel(page).locator('[data-pr-link-toggle]').click()
  await page.locator('#pull_request_url').fill(urls.join(' '))
  await Promise.all([
    page.waitForResponse((r) => r.request().method() === 'POST' && r.url().endsWith('/pull_requests')),
    form.locator('[type="submit"]').click(),
  ])
}

// Creates a project with the pull requests module, the manager as Manager and
// dev as Developer
export async function createProject(request, { repositories } = {}) {
  const headers = { 'X-Redmine-API-Key': ADMIN_API_KEY }
  const identifier = `e2e-${Date.now()}`
  const response = await request.post('/projects.json', {
    headers,
    data: { project: { name: identifier, identifier, is_public: false, enabled_module_names: ['issue_tracking', 'pull_requests'] } },
  })
  expect(response.status()).toBe(201)
  const project = (await response.json()).project
  const roles = (await (await request.get('/roles.json', { headers })).json()).roles
  for (const [login, role] of [['manager', 'Manager'], ['dev', 'Developer']]) {
    const [user] = (await (await request.get(`/users.json?name=${login}`, { headers })).json()).users
    const membership = await request.post(`/projects/${identifier}/memberships.json`, {
      headers, data: { membership: { user_id: user.id, role_ids: [roles.find((r) => r.name === role).id] } },
    })
    expect(membership.status()).toBe(201)
  }
  return project
}

export async function csrfToken(page) {
  return page.locator('meta[name=csrf-token]').getAttribute('content')
}
