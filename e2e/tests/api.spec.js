import { test, expect } from '@playwright/test'
import {
  API_KEYS, createIssue, resetMockApi, sendWebhook, uniqueNumber, updateGithubPullRequest,
} from './helpers.js'

const PR = 'https://github.com/acme/web/pull/42'
const MR = 'https://gitlab.com/acme/platform/web/-/merge_requests/12'

function api(request, user = 'dev') {
  const headers = { 'X-Redmine-API-Key': API_KEYS[user] }
  return {
    get: (path) => request.get(path, { headers }),
    post: (path, data) => request.post(path, { headers, data }),
    delete: (path) => request.delete(path, { headers }),
  }
}

test.beforeEach(async ({ request }) => {
  await resetMockApi(request)
})

test.describe('REST API', () => {
  test('links, lists, shows, refreshes and unlinks pull requests', async ({ request }) => {
    const issue = await createIssue(request)
    const base = `/issues/${issue.id}/pull_requests`
    const dev = api(request)

    const empty = await dev.get(`${base}.json`)
    expect(empty.status()).toBe(200)
    expect(await empty.json()).toEqual({ pull_requests: [], total_count: 0 })

    const created = await dev.post(`${base}.json`, { pull_request: { urls: [PR, MR] } })
    expect(created.status()).toBe(201)
    const { pull_requests: linked } = await created.json()
    expect(linked.map((pr) => pr.reference).sort()).toEqual(['acme/platform/web!12', 'acme/web#42'])

    const list = await (await dev.get(`${base}.json`)).json()
    expect(list.total_count).toBe(2)
    const pr = list.pull_requests.find((p) => p.provider === 'github')
    expect(pr).toMatchObject({
      repository: 'acme/web', number: 42, url: PR, title: 'Add OAuth login with GitHub and Google',
      state: 'open', status: 'open', draft: false, author: { login: 'octocat' },
      head_ref: 'feature/oauth-login', base_ref: 'main', commits_count: 7, additions: 1312, deletions: 48,
      review_decision: 'approved', comments_count: 12, unresolved_threads_count: 2,
      checks: { state: 'pending', total: 4, passed: 3, failed: 0, url: `${PR}/checks` },
      linked_by: { name: 'Dana Tester' }, link_source: 'manual',
    })
    expect(pr.reviewers.map((r) => [r.login, r.state])).toEqual([
      ['monalisa', 'approved'], ['hubot', 'commented'], ['sidney', 'pending'],
    ])
    expect(pr.opened_on).toMatch(/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/)

    const show = await dev.get(`${base}/${pr.id}.json`)
    expect((await show.json()).pull_request.reference).toBe('acme/web#42')

    await updateGithubPullRequest(request, 'acme/web#42', { state: 'closed', closed_at: new Date().toISOString() })
    const refreshed = await dev.post(`${base}/${pr.id}/refresh.json`)
    expect(refreshed.status()).toBe(200)
    expect((await refreshed.json()).pull_request.status).toBe('closed')

    const deleted = await dev.delete(`${base}/${pr.id}.json`)
    expect(deleted.status()).toBe(204)
    expect((await (await dev.get(`${base}.json`)).json()).total_count).toBe(1)
    expect((await dev.get(`${base}/${pr.id}.json`)).status()).toBe(404)
  })

  test('accepts a single url and is idempotent', async ({ request }) => {
    const issue = await createIssue(request)
    const dev = api(request)
    for (let i = 0; i < 2; i++) {
      const response = await dev.post(`/issues/${issue.id}/pull_requests.json`, { pull_request: { url: MR } })
      expect(response.status()).toBe(201)
      expect((await response.json()).pull_requests).toHaveLength(1)
    }
    expect((await (await dev.get(`/issues/${issue.id}/pull_requests.json`)).json()).total_count).toBe(1)
  })

  test('links nothing if one of the urls fails', async ({ request }) => {
    const issue = await createIssue(request)
    const dev = api(request)
    const response = await dev.post(`/issues/${issue.id}/pull_requests.json`, {
      pull_request: { urls: [PR, 'https://example.com/nope', 'https://github.com/acme/web/pull/9999'] },
    })
    expect(response.status()).toBe(422)
    expect(await response.json()).toEqual({
      errors: [
        'https://example.com/nope is not a GitHub pull request or GitLab merge request URL.',
        'Could not load acme/web#9999 from GitHub (404 Not Found).',
      ],
    })
    expect((await (await dev.get(`/issues/${issue.id}/pull_requests.json`)).json()).total_count).toBe(0)

    const blank = await dev.post(`/issues/${issue.id}/pull_requests.json`, { pull_request: { url: '' } })
    expect(blank.status()).toBe(422)
    expect((await blank.json()).errors).toEqual(['Please enter a pull request URL.'])
  })

  test('a failed request does not store the pull requests it loaded', async ({ request }) => {
    const number = uniqueNumber()
    await updateGithubPullRequest(request, `acme/web#${number}`, { title: 'Loaded, but not linked' })
    const issue = await createIssue(request)
    const response = await api(request).post(`/issues/${issue.id}/pull_requests.json`, {
      pull_request: { urls: [`https://github.com/acme/web/pull/${number}`, 'https://example.com/nope'] },
    })
    expect(response.status()).toBe(422)

    // webhooks only refresh pull requests that are known
    const review = await sendWebhook(request, {
      action: 'submitted', pull_request: { number }, repository: { full_name: 'acme/web' },
    }, { event: 'pull_request_review' })
    expect(await review.json()).toEqual({ status: 'ignored', pull_requests: [] })
  })

  test('only links repositories allowed in the project', async ({ request }) => {
    const dev = api(request)
    const issue = await createIssue(request)
    const response = await dev.post(`/issues/${issue.id}/pull_requests.json`, {
      pull_request: { urls: [PR, 'https://github.com/acme/secret/pull/1', 'https://gitlab.com/acme/web/-/merge_requests/1'] },
    })
    expect(response.status()).toBe(422)
    expect((await response.json()).errors).toEqual([
      'acme/secret is not allowed in this project (project settings › Pull requests).',
      'acme/web is not allowed in this project (project settings › Pull requests).',
    ])

    // nothing is allowed in this project yet
    const unconfigured = await createIssue(request, { project: 'unconfigured' })
    const rejected = await dev.post(`/issues/${unconfigured.id}/pull_requests.json`, { pull_request: { url: PR } })
    expect(rejected.status()).toBe(422)
    expect((await rejected.json()).errors).toEqual([
      'No repositories are allowed in this project yet (project settings › Pull requests).',
    ])
  })

  test('limits the number of urls and rejects malformed parameters', async ({ request }) => {
    const dev = api(request)
    const issue = await createIssue(request)
    const path = `/issues/${issue.id}/pull_requests.json`
    const urls = Array.from({ length: 21 }, (_, i) => `https://github.com/acme/web/pull/${i + 1}`)
    const tooMany = await dev.post(path, { pull_request: { urls } })
    expect(tooMany.status()).toBe(422)
    expect((await tooMany.json()).errors).toEqual(['Please link at most 20 pull requests at once.'])

    for (const data of [{ pull_request: 'foo' }, { pull_request: { urls: { a: PR } } }, { pull_request: { url: [[PR]] } }]) {
      const response = await dev.post(path, data)
      expect(response.status()).toBe(422)
      expect((await response.json()).errors).toEqual(['Please enter a pull request URL.'])
    }
  })

  test('repository names are case-insensitive', async ({ request }) => {
    const dev = api(request)
    const issue = await createIssue(request)
    const response = await dev.post(`/issues/${issue.id}/pull_requests.json`, {
      pull_request: { url: 'https://github.com/ACME/Web/pull/42' },
    })
    expect(response.status()).toBe(201)
    // stored with the name GitHub uses, so webhooks find it
    const [linked] = (await response.json()).pull_requests
    expect(linked.reference).toBe('acme/web#42')
    const other = await createIssue(request)
    const again = await dev.post(`/issues/${other.id}/pull_requests.json`, {
      pull_request: { url: 'https://github.com/Acme/WEB/pull/42' },
    })
    expect((await again.json()).pull_requests[0].id).toBe(linked.id)
  })

  test('supports XML', async ({ request }) => {
    const issue = await createIssue(request)
    const dev = api(request)
    await dev.post(`/issues/${issue.id}/pull_requests.json`, { pull_request: { url: PR } })
    const response = await dev.get(`/issues/${issue.id}/pull_requests.xml`)
    expect(response.headers()['content-type']).toContain('application/xml')
    const xml = await response.text()
    expect(xml).toContain('<pull_requests total_count="1" type="array">')
    expect(xml).toContain('<reference>acme/web#42</reference>')
    expect(xml).toContain('<reviewer login="monalisa" state="approved"')
  })

  test('respects authentication, permissions, visibility and the project module', async ({ request }) => {
    const issue = await createIssue(request)
    const path = `/issues/${issue.id}/pull_requests.json`
    await api(request).post(path, { pull_request: { url: PR } })

    // no API key: login required for the private project
    expect((await request.get(path)).status()).toBe(401)

    // reporters may read but not change
    const reporter = api(request, 'reporter')
    expect((await reporter.get(path)).status()).toBe(200)
    expect((await reporter.post(path, { pull_request: { url: MR } })).status()).toBe(403)
    const [linked] = (await (await reporter.get(path)).json()).pull_requests
    expect((await reporter.delete(`/issues/${issue.id}/pull_requests/${linked.id}.json`)).status()).toBe(403)

    // same status codes as /issues/:id.json for issues the user can't see
    const secret = await createIssue(request, { project: 'secret' })
    expect((await api(request).get(`/issues/${secret.id}/pull_requests.json`)).status()).toBe(403)
    expect((await api(request).get('/issues/999999/pull_requests.json')).status()).toBe(404)

    // project without the pull requests module
    const legacy = await createIssue(request, { project: 'legacy' })
    expect((await api(request).get(`/issues/${legacy.id}/pull_requests.json`)).status()).toBe(403)
  })
})
