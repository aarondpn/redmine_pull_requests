import { createHmac } from 'node:crypto'
import { test, expect } from '@playwright/test'
import {
  API_KEYS, GITLAB_WEBHOOK_SECRET, USERS, WEBHOOK_SECRET, createIssue, getIssue, login, mergeRequestPayload, panel,
  pullRequestPayload, reloadUntil, resetMockApi, sendGitlabWebhook, sendWebhook, uniqueNumber, updateGithubPullRequest,
} from './helpers.js'

test.beforeEach(async ({ request }) => {
  await resetMockApi(request)
})

function sendRaw(request, body, { provider = 'github', event } = {}) {
  const headers = { 'Content-Type': 'application/json' }
  if (provider === 'github') {
    headers['X-GitHub-Event'] = event || 'pull_request'
    headers['X-Hub-Signature-256'] = 'sha256=' + createHmac('sha256', WEBHOOK_SECRET).update(body).digest('hex')
  } else {
    headers['X-Gitlab-Event'] = event || 'Merge Request Hook'
    headers['X-Gitlab-Token'] = GITLAB_WEBHOOK_SECRET
  }
  return request.post(`/pull_requests/${provider}/webhook`, { headers, data: body })
}

test.describe('webhook processing', () => {
  test('a refresh that sees the merge first does not prevent the fixing keywords', async ({ page, request }) => {
    const issue = await createIssue(request, { subject: 'Auto-merged fix' })
    const number = uniqueNumber()
    const options = { number, title: 'Fix with auto-merge', body: `Fixes #${issue.id}` }
    await updateGithubPullRequest(request, `acme/web#${number}`, { title: options.title, body: options.body })
    await sendWebhook(request, pullRequestPayload('opened', options))

    // auto-merge: the last check suite completes and its refresh already loads the merged state
    const now = new Date().toISOString()
    await updateGithubPullRequest(request, `acme/web#${number}`, { state: 'closed', merged: true, merged_at: now, closed_at: now })
    const checked = await sendWebhook(request, {
      action: 'completed', check_suite: { head_sha: `acme-web-${number}-sha`, pull_requests: [{ number }] },
      repository: { full_name: 'acme/web' },
    }, { event: 'check_suite' })
    expect(await checked.json()).toEqual({ status: 'queued', pull_requests: [`acme/web#${number}`] })
    await login(page, USERS.dev)
    await page.goto(`/issues/${issue.id}`)
    await reloadUntil(page, () => expect(panel(page).locator('.pr')).toHaveAttribute('data-status', 'merged', { timeout: 500 }))
    expect((await getIssue(request, issue.id)).status.name).toBe('New')

    const merged = await sendWebhook(request, pullRequestPayload('closed', { ...options, state: 'closed', merged: true }))
    expect((await merged.json()).fixed_issues).toEqual([issue.id])
    expect((await getIssue(request, issue.id)).status.name).toBe('Resolved')
  })

  test('a late delivery does not reopen a merged pull request', async ({ request }) => {
    const issue = await createIssue(request)
    const options = { number: uniqueNumber(), title: 'Merged', body: `refs #${issue.id}` }
    await sendWebhook(request, pullRequestPayload('closed', { ...options, state: 'closed', merged: true }))
    await sendWebhook(request, pullRequestPayload('synchronize', options))
    const [linked] = (await (await request.get(`/issues/${issue.id}/pull_requests.json`, {
      headers: { 'X-Redmine-API-Key': API_KEYS.dev },
    })).json()).pull_requests
    expect(linked.status).toBe('merged')
  })

  test('concurrent deliveries for a new pull request are all accepted', async ({ request }) => {
    const issue = await createIssue(request)
    const options = { number: uniqueNumber(), title: 'Parallel', body: `refs #${issue.id}` }
    const responses = await Promise.all(['opened', 'review_requested', 'opened', 'review_requested', 'synchronize']
      .map((action) => sendWebhook(request, pullRequestPayload(action, options))))
    expect(responses.map((r) => r.status())).toEqual([200, 200, 200, 200, 200])
    const { total_count: count } = await (await request.get(`/issues/${issue.id}/pull_requests.json`, {
      headers: { 'X-Redmine-API-Key': API_KEYS.dev },
    })).json()
    expect(count).toBe(1)
  })

  test('GitLab updates only relink issues when the title or description changed', async ({ request }) => {
    const issue = await createIssue(request)
    const dev = { 'X-Redmine-API-Key': API_KEYS.dev }
    const options = { iid: uniqueNumber(), title: 'Labels', description: `refs #${issue.id}` }
    const opened = await sendGitlabWebhook(request, mergeRequestPayload('open', options))
    expect((await opened.json()).linked_issues).toEqual([issue.id])
    const [linked] = (await (await request.get(`/issues/${issue.id}/pull_requests.json`, { headers: dev })).json()).pull_requests
    expect((await request.delete(`/issues/${issue.id}/pull_requests/${linked.id}.json`, { headers: dev })).status()).toBe(204)

    for (const changes of [{ labels: { previous: [], current: [{ title: 'bug' }] } }, { reviewers: { previous: [], current: [] } }]) {
      const updated = await sendGitlabWebhook(request, mergeRequestPayload('update', { ...options, changes }))
      expect(await updated.json()).toMatchObject({ status: 'processed', linked_issues: [] })
    }
    const edited = await sendGitlabWebhook(request, mergeRequestPayload('update', {
      ...options, changes: { description: { previous: '', current: options.description } },
    }))
    expect((await edited.json()).linked_issues).toEqual([issue.id])
  })

  test('rejects malformed payloads with 4xx', async ({ request }) => {
    expect((await sendRaw(request, '[1]')).status()).toBe(400)
    expect((await sendRaw(request, '"text"', { event: 'check_run' })).status()).toBe(400)
    expect((await sendRaw(request, '[]', { provider: 'gitlab' })).status()).toBe(400)

    const invalid = [
      ['repository', (p) => { p.repository.full_name = 'evil/<b>repo</b>' }],
      ['repository', (p) => { p.repository.full_name = 'acme/../../user' }],
      ['number', (p) => { p.pull_request.number = '42?x=1' }],
      ['pull_request', (p) => { p.pull_request.user = 'octocat' }],
    ]
    for (const [error, change] of invalid) {
      const payload = pullRequestPayload('opened', { number: 42, title: 'Malformed' })
      change(payload)
      const response = await sendRaw(request, JSON.stringify(payload))
      expect(response.status()).toBe(422)
      expect((await response.json()).error).toContain(error)
    }
    const check = await sendRaw(request, JSON.stringify({ check_run: { head_sha: 'x' }, repository: { full_name: '../x' } }), { event: 'check_run' })
    expect(check.status()).toBe(422)

    const mr = mergeRequestPayload('open', { project: 'acme/../web', iid: 1, title: 'Malformed' })
    expect((await sendRaw(request, JSON.stringify(mr), { provider: 'gitlab' })).status()).toBe(422)
    const iid = mergeRequestPayload('open', { iid: '1/../2', title: 'Malformed' })
    expect((await sendRaw(request, JSON.stringify(iid), { provider: 'gitlab' })).status()).toBe(422)
    const note = { object_kind: 'note', project: { path_with_namespace: 'a b/c' }, merge_request: { iid: 1 } }
    expect((await sendRaw(request, JSON.stringify(note), { provider: 'gitlab', event: 'Note Hook' })).status()).toBe(422)
  })
})
