import { test, expect } from '@playwright/test'
import {
  USERS, createIssue, getIssue, linkPullRequests, login, mergeRequestPayload, panel, pullRequestPayload,
  reloadUntil, resetMockApi, sendGitlabWebhook, sendWebhook, uniqueNumber, updateGithubPullRequest,
  updateGitlabMergeRequest,
} from './helpers.js'

const PR = {
  open: 'https://github.com/acme/web/pull/42',
  merged: 'https://github.com/acme/api/pull/108',
  draft: 'https://github.com/acme/web/pull/57',
  closed: 'https://github.com/acme/web/pull/61',
}

test.beforeEach(async ({ request }) => {
  await resetMockApi(request)
})

test.describe('linking pull requests manually', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, USERS.dev)
  })

  test('shows an empty state and the link form', async ({ page, request }) => {
    const issue = await createIssue(request)
    await page.goto(`/issues/${issue.id}`)

    await expect(panel(page)).toContainText('No pull requests linked yet')
    await expect(page.locator('#new-pull-request-form')).toBeHidden()
    await panel(page).getByRole('link', { name: 'Link pull request', exact: true }).click()
    await expect(page.locator('#pull_request_url')).toBeFocused()
  })

  test('links an open pull request with GitHub details', async ({ page, request }) => {
    const issue = await createIssue(request)
    await page.goto(`/issues/${issue.id}`)
    await linkPullRequests(page, [PR.open])

    const card = panel(page).locator('.pr').first()
    await expect(card).toHaveAttribute('data-status', 'open')
    await expect(card.locator('.pr-title')).toHaveText('Add OAuth login with GitHub and Google')
    await expect(card.locator('.pr-title')).toHaveAttribute('href', PR.open)
    await expect(card.locator('.pr-number')).toHaveText('#42')
    await expect(card.locator('.pr-repo')).toHaveText('acme/web')
    await expect(card.locator('.pr-summary')).toContainText('octocat wants to merge 7 commits into main from feature/oauth-login')
    await expect(card.locator('.pr-diff__add')).toHaveText('+1,312')
    await expect(card.locator('.pr-diff__del')).toHaveText('−48')
    await expect(card.locator('.pr-state')).toHaveText('Open')
    await expect(page.locator('#new-pull-request-form')).toBeHidden()

    // survives a reload (persisted, not just rendered by the XHR response)
    await page.reload()
    await expect(panel(page).locator('.pr')).toHaveCount(1)
    await expect(panel(page).locator('.pr-counter')).toHaveText('1')
  })

  test('links multiple pull requests to one issue', async ({ page, request }) => {
    const issue = await createIssue(request)
    await page.goto(`/issues/${issue.id}`)
    await linkPullRequests(page, [PR.open, PR.merged])
    await linkPullRequests(page, [PR.draft, PR.closed])

    const cards = panel(page).locator('.pr')
    await expect(cards).toHaveCount(4)
    // open (incl. draft) first, then merged, then closed
    await expect(cards.locator('.pr-number')).toHaveText(['#57', '#42', '#108', '#61'])
    await expect(cards.locator('.pr-state')).toHaveText(['Draft', 'Open', 'Merged', 'Closed'])
    await expect(panel(page).locator('.pr-counter')).toHaveText('4')
    await expect(panel(page).locator('.pr-stat')).toHaveText(['1', '1', '1', '1'])

    const merged = cards.filter({ has: page.locator('.pr-number', { hasText: '#108' }) })
    await expect(merged.locator('.pr-summary')).toContainText('monalisa merged 3 commits into main from rate-limit')
    const closed = cards.filter({ has: page.locator('.pr-number', { hasText: '#61' }) })
    await expect(closed.locator('.pr-summary')).toContainText("hubot's pull request was closed without merging")
  })

  test('links the same pull request to several issues', async ({ page, request }) => {
    const first = await createIssue(request)
    const second = await createIssue(request)
    for (const issue of [first, second]) {
      await page.goto(`/issues/${issue.id}`)
      await linkPullRequests(page, [PR.open])
      await expect(panel(page).locator('.pr')).toHaveCount(1)
    }

    // unlinking from one issue keeps it on the other
    await page.goto(`/issues/${first.id}`)
    page.once('dialog', (dialog) => dialog.accept())
    await panel(page).locator('.pr').hover()
    await panel(page).getByRole('link', { name: 'Unlink pull request' }).click()
    await expect(panel(page).locator('.pr')).toHaveCount(0)

    await page.goto(`/issues/${second.id}`)
    await expect(panel(page).locator('.pr')).toHaveCount(1)
  })

  test('ignores duplicate URLs', async ({ page, request }) => {
    const issue = await createIssue(request)
    await page.goto(`/issues/${issue.id}`)
    await linkPullRequests(page, [PR.merged, PR.merged.replace(/$/, '/files')])

    await expect(panel(page).locator('.pr')).toHaveCount(1)
    await expect(panel(page).locator('.pr')).toHaveAttribute('data-status', 'merged')
  })

  test('reports invalid URLs and GitHub errors', async ({ page, request }) => {
    const issue = await createIssue(request)
    await page.goto(`/issues/${issue.id}`)
    await linkPullRequests(page, [
      'https://bitbucket.org/acme/web/pull-requests/1', 'https://github.com/acme/web/pull/9999',
      'https://github.com/acme/secret/pull/1', PR.open,
    ])

    const errors = panel(page).locator('.pr-errors')
    await expect(errors).toContainText('https://bitbucket.org/acme/web/pull-requests/1 is not a GitHub pull request or GitLab merge request URL.')
    await expect(errors).toContainText('Could not load acme/web#9999 from GitHub (404 Not Found).')
    await expect(errors).toContainText('acme/secret is not allowed in this project (project settings › Pull requests).')
    // the valid one is linked anyway and the form stays open for corrections
    await expect(panel(page).locator('.pr')).toHaveCount(1)
    await expect(page.locator('#new-pull-request-form')).toBeVisible()
  })

  test('refreshes a pull request from GitHub', async ({ page, request }) => {
    // merged pull requests stay merged, so this one is new on every run
    const number = uniqueNumber()
    await updateGithubPullRequest(request, `acme/web#${number}`, { title: 'Add OAuth login', commits: 7 })
    const issue = await createIssue(request)
    await page.goto(`/issues/${issue.id}`)
    await linkPullRequests(page, [`https://github.com/acme/web/pull/${number}`])
    await expect(panel(page).locator('.pr-state')).toHaveText('Open')

    const now = new Date().toISOString()
    await updateGithubPullRequest(request, `acme/web#${number}`, {
      title: 'Add OAuth login (GitHub only)', state: 'closed', merged: true, merged_at: now, closed_at: now,
      merged_by: { login: 'monalisa' }, commits: 8,
    })
    await panel(page).locator('.pr').hover()
    await panel(page).getByRole('link', { name: 'Refresh from GitHub' }).click()

    const card = panel(page).locator('.pr')
    await expect(card).toHaveAttribute('data-status', 'merged')
    await expect(card.locator('.pr-title')).toHaveText('Add OAuth login (GitHub only)')
    await expect(card.locator('.pr-summary')).toContainText('monalisa merged 8 commits')
  })

  test('a failed refresh shows the error without opening the link form', async ({ page, request }) => {
    const issue = await createIssue(request)
    await page.goto(`/issues/${issue.id}`)
    await linkPullRequests(page, [PR.open])
    await expect(panel(page).locator('.pr')).toHaveCount(1)

    await updateGithubPullRequest(request, 'acme/web#42', { error: 502 })
    await panel(page).locator('.pr').hover()
    await panel(page).getByRole('link', { name: 'Refresh from GitHub' }).click()
    await expect(panel(page).locator('.pr-errors')).toContainText('Could not load acme/web#42 from GitHub (502 Server Error).')
    await expect(page.locator('#new-pull-request-form')).toBeHidden()
    await expect(page.locator('#pull_request_url')).not.toBeFocused()
  })

  test('unlinks a pull request after confirmation', async ({ page, request }) => {
    const issue = await createIssue(request)
    await page.goto(`/issues/${issue.id}`)
    await linkPullRequests(page, [PR.open, PR.draft])
    await expect(panel(page).locator('.pr')).toHaveCount(2)

    // in the compact list the actions are part of the expanded row
    const card = panel(page).locator('.pr', { hasText: '#57' })
    await card.getByRole('button', { name: 'Show details' }).click()
    page.once('dialog', (dialog) => dialog.dismiss())
    await card.getByRole('link', { name: 'Unlink pull request' }).click()
    await expect(panel(page).locator('.pr')).toHaveCount(2)

    page.once('dialog', (dialog) => dialog.accept())
    await card.getByRole('link', { name: 'Unlink pull request' }).click()
    await expect(panel(page).locator('.pr')).toHaveCount(1)
    await expect(panel(page).locator('.pr-number')).toHaveText('#42')
  })
})

test.describe('compact list', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, USERS.dev)
  })

  test('a single pull request is shown as a full card', async ({ page, request }) => {
    const issue = await createIssue(request)
    await page.goto(`/issues/${issue.id}`)
    await linkPullRequests(page, [PR.open])

    await expect(panel(page).locator('.pr-list')).not.toHaveClass(/pr-list--compact/)
    await expect(panel(page).locator('.pr-card__details')).toBeVisible()
    await expect(panel(page).locator('[data-pr-view-toggle]')).toHaveCount(0)
  })

  test('several pull requests are compact rows that expand on click', async ({ page, request }) => {
    const issue = await createIssue(request)
    await page.goto(`/issues/${issue.id}`)
    await linkPullRequests(page, [PR.open, PR.merged, PR.draft])

    await expect(panel(page).locator('.pr-list')).toHaveClass(/pr-list--compact/)
    const row = panel(page).locator('.pr', { hasText: '#42' })
    await expect(row.locator('.pr-card__body')).toBeHidden()
    await expect(row.locator('.pr-state')).toBeHidden()
    await expect(row.locator('.pr-actions')).toBeHidden()
    const indicators = row.locator('.pr-compact-indicators')
    await expect(indicators.getByLabel('Approved')).toBeVisible()
    await expect(indicators.getByLabel('12 comments')).toBeVisible()
    await expect(indicators.getByLabel('2 unresolved threads')).toBeVisible()
    await expect(indicators.locator('.pr-checks')).toHaveAttribute('title', '3 successful, 0 failing, 1 in progress')

    // a click anywhere on the row (except links) expands it
    await row.locator('.pr-compact-repo').click()
    await expect(row).toHaveClass(/is-expanded/)
    await expect(row.locator('.pr-card__body')).toBeVisible()
    await expect(row.locator('.pr-compact-indicators')).toBeHidden()
    await expect(row.locator('.pr-actions')).toBeVisible()
    const toggle = row.getByRole('button', { name: 'Hide details' })
    await expect(toggle).toHaveAttribute('aria-expanded', 'true')
    await expect(panel(page).locator('.pr.is-expanded')).toHaveCount(1)

    // stays expanded when the panel is updated
    await row.getByRole('link', { name: 'Refresh from GitHub' }).click()
    await expect(panel(page).locator('.pr', { hasText: '#42' })).toHaveClass(/is-expanded/)

    await panel(page).locator('.pr', { hasText: '#42' }).getByRole('button', { name: 'Hide details' }).click()
    await expect(panel(page).locator('.pr.is-expanded')).toHaveCount(0)
  })

  test('the view can be switched and is remembered', async ({ page, request }) => {
    const issue = await createIssue(request)
    await page.goto(`/issues/${issue.id}`)
    await linkPullRequests(page, [PR.open, PR.merged])

    await panel(page).getByRole('button', { name: 'Expand all' }).click()
    await expect(panel(page).locator('.pr-list')).not.toHaveClass(/pr-list--compact/)
    await expect(panel(page).locator('.pr-card__details')).toHaveCount(2)
    await expect(panel(page).locator('.pr-card__body').first()).toBeVisible()

    await page.reload()
    await expect(panel(page).locator('.pr-list')).not.toHaveClass(/pr-list--compact/)
    await panel(page).getByRole('button', { name: 'Compact view' }).click()
    await expect(panel(page).locator('.pr-list')).toHaveClass(/pr-list--compact/)
    await page.reload()
    await expect(panel(page).locator('.pr-list')).toHaveClass(/pr-list--compact/)
  })
})

test.describe('permissions', () => {
  test('reporters can see but not manage pull requests', async ({ browser, request }) => {
    const issue = await createIssue(request)
    const devPage = await browser.newPage()
    await login(devPage, USERS.dev)
    await devPage.goto(`/issues/${issue.id}`)
    await linkPullRequests(devPage, [PR.open])
    await expect(panel(devPage).locator('.pr')).toHaveCount(1)

    const reporterPage = await browser.newPage()
    await login(reporterPage, USERS.reporter)
    await reporterPage.goto(`/issues/${issue.id}`)
    await expect(panel(reporterPage).locator('.pr')).toHaveCount(1)
    await expect(panel(reporterPage).getByRole('link', { name: 'Link pull request', exact: true })).toHaveCount(0)
    await expect(panel(reporterPage).locator('.pr-actions')).toHaveCount(0)

    // the endpoints are protected as well
    const response = await reporterPage.request.post(`/issues/${issue.id}/pull_requests`, {
      form: { url: PR.draft }, headers: { 'X-CSRF-Token': await reporterPage.locator('meta[name=csrf-token]').getAttribute('content') },
    })
    expect(response.status()).toBe(403)
  })

  test('the panel is hidden when the project module is disabled', async ({ page, request }) => {
    const issue = await createIssue(request, { project: 'legacy' })
    await login(page, USERS.dev)
    await page.goto(`/issues/${issue.id}`)
    await expect(page.locator('#issue_description_wiki, .issue.details').first()).toBeVisible()
    await expect(panel(page)).toHaveCount(0)
  })
})

test.describe('GitHub webhook', () => {
  test('rejects requests with an invalid signature', async ({ request }) => {
    const payload = pullRequestPayload('opened', { number: 900, title: 'Nope' })
    const response = await sendWebhook(request, payload, { secret: 'wrong-secret' })
    expect(response.status()).toBe(401)
  })

  test('answers ping events', async ({ request }) => {
    const response = await sendWebhook(request, { zen: 'Keep it logically awesome.' }, { event: 'ping' })
    expect(response.status()).toBe(200)
    expect(await response.json()).toEqual({ status: 'ok' })
  })

  test('ignores pull requests that reference no issue', async ({ request }) => {
    const response = await sendWebhook(request, pullRequestPayload('opened', { number: 901, title: 'Bump dependencies' }))
    expect((await response.json()).status).toBe('ignored')
  })

  test('links issues referenced in title, body and branch name', async ({ page, request }) => {
    const [byTitle, byBody, byBranch, byUrl, legacy, secret] = await Promise.all([
      createIssue(request), createIssue(request), createIssue(request), createIssue(request),
      createIssue(request, { project: 'legacy' }), createIssue(request, { project: 'secret' }),
    ])
    const payload = pullRequestPayload('opened', {
      number: 902,
      title: `Improve checkout #${byTitle.id}`,
      body: `Also refs #${byBody.id}, #${legacy.id} and #${secret.id}.\n\nSee http://localhost:3000/issues/${byUrl.id}`,
      branch: `feature/${byBranch.id}-checkout`,
    })
    const response = await sendWebhook(request, payload)
    const result = await response.json()
    expect(result.status).toBe('processed')
    // issues of projects without the module or that don't allow acme/web are not linked
    expect(result.linked_issues.sort()).toEqual([byTitle.id, byBody.id, byBranch.id, byUrl.id].sort())

    await login(page, USERS.dev)
    await page.goto(`/issues/${byBranch.id}`)
    const card = panel(page).locator('.pr')
    await expect(card.locator('.pr-title')).toHaveText(`Improve checkout #${byTitle.id}`)
    await expect(card).toHaveAttribute('data-status', 'open')
  })

  test('tracks state changes and resolves fixed issues on merge', async ({ page, request }) => {
    const fixed = await createIssue(request, { subject: 'Login button does nothing' })
    const related = await createIssue(request, { subject: 'Login audit' })
    const number = uniqueNumber()
    const options = {
      number, title: 'Fix login button', body: `Fixes #${fixed.id}, refs #${related.id}`, branch: 'fix-login',
    }

    await sendWebhook(request, pullRequestPayload('opened', { ...options, draft: true }))
    await login(page, USERS.dev)
    await page.goto(`/issues/${fixed.id}`)
    await expect(panel(page).locator('.pr')).toHaveAttribute('data-status', 'draft')

    await sendWebhook(request, pullRequestPayload('ready_for_review', options))
    await page.reload()
    await expect(panel(page).locator('.pr')).toHaveAttribute('data-status', 'open')

    const response = await sendWebhook(request, pullRequestPayload('closed', { ...options, state: 'closed', merged: true }))
    expect((await response.json()).fixed_issues).toEqual([fixed.id])

    await page.reload()
    await expect(panel(page).locator('.pr')).toHaveAttribute('data-status', 'merged')
    await expect(page.locator('.issue .attributes .status .value')).toHaveText('Resolved')
    await expect(page.locator('#history')).toContainText(`Applied in pull request acme/web#${number}.`)

    expect((await getIssue(request, fixed.id)).done_ratio).toBe(100)
    expect((await getIssue(request, related.id)).status.name).toBe('New')

    // repeated deliveries do not touch the issue again
    const again = await sendWebhook(request, pullRequestPayload('closed', { ...options, state: 'closed', merged: true }))
    expect((await again.json()).fixed_issues).toEqual([])
  })

  test('does not re-link a manually unlinked pull request on push', async ({ page, request }) => {
    const issue = await createIssue(request)
    const options = { number: 905, title: 'Tidy up', body: `refs #${issue.id}` }
    await sendWebhook(request, pullRequestPayload('opened', options))

    await login(page, USERS.dev)
    await page.goto(`/issues/${issue.id}`)
    page.once('dialog', (dialog) => dialog.accept())
    await panel(page).getByRole('link', { name: 'Unlink pull request' }).click()
    await expect(panel(page).locator('.pr')).toHaveCount(0)

    const response = await sendWebhook(request, pullRequestPayload('synchronize', options))
    expect((await response.json()).linked_issues).toEqual([])
    await page.reload()
    await expect(panel(page).locator('.pr')).toHaveCount(0)
  })

  test('rejects pull requests with unsafe URLs', async ({ request }) => {
    const issue = await createIssue(request)
    const payload = pullRequestPayload('opened', { number: 906, title: 'XSS', body: `refs #${issue.id}` })
    payload.pull_request.html_url = 'javascript:alert(document.cookie)'
    const response = await sendWebhook(request, payload)
    expect(response.status()).toBe(422)
  })

  test('marks pull requests closed without merging', async ({ page, request }) => {
    const issue = await createIssue(request)
    const options = { number: 904, title: 'Experiment', body: `refs #${issue.id}` }
    await sendWebhook(request, pullRequestPayload('opened', options))
    await sendWebhook(request, pullRequestPayload('closed', { ...options, state: 'closed' }))

    await login(page, USERS.dev)
    await page.goto(`/issues/${issue.id}`)
    await expect(panel(page).locator('.pr')).toHaveAttribute('data-status', 'closed')
    expect((await getIssue(request, issue.id)).status.name).toBe('New')
  })
})

test.describe('GitLab merge requests', () => {
  const MR = {
    open: 'https://gitlab.com/acme/platform/web/-/merge_requests/12',
    merged: 'https://gitlab.com/acme/platform/web/merge_requests/15/diffs',
    other: 'https://gitlab.com/acme/platform/web/-/merge_requests/21',
  }

  test('links GitLab merge requests next to GitHub pull requests', async ({ page, request }) => {
    const issue = await createIssue(request)
    await login(page, USERS.dev)
    await page.goto(`/issues/${issue.id}`)
    await linkPullRequests(page, [MR.open, PR.open, MR.merged])

    const cards = panel(page).locator('.pr')
    await expect(cards).toHaveCount(3)
    const gitlab = cards.filter({ has: page.locator('.pr-number', { hasText: '!12' }) })
    await expect(gitlab).toHaveAttribute('data-provider', 'gitlab')
    await expect(gitlab).toHaveAttribute('data-status', 'open')
    await expect(gitlab.locator('.pr-title')).toHaveText('Migrate CI to GitLab pipelines')
    await expect(gitlab.locator('.pr-title')).toHaveAttribute('href', MR.open)
    await expect(gitlab.locator('.pr-repo')).toHaveText('acme/platform/web')
    await expect(gitlab.locator('.pr-repo')).toHaveAttribute('href', 'https://gitlab.com/acme/platform/web')
    await expect(gitlab.getByRole('img', { name: 'GitLab' })).toBeVisible()
    // commit count comes from the commits endpoint, GitLab has no line stats
    await expect(gitlab.locator('.pr-summary')).toContainText('tanuki wants to merge 4 commits into main from ci-migration')
    await expect(gitlab.locator('.pr-diff')).toHaveCount(0)

    const merged = cards.filter({ has: page.locator('.pr-number', { hasText: '!15' }) })
    await expect(merged).toHaveAttribute('data-status', 'merged')
    await expect(merged.locator('.pr-summary')).toContainText('tanuki merged 2 commits into main from cache-deps')

    const github = cards.filter({ has: page.locator('.pr-number', { hasText: '#42' }) })
    await expect(github).toHaveAttribute('data-provider', 'github')
    await expect(github.getByRole('img', { name: 'GitHub' })).toBeVisible()
  })

  test('refreshes a merge request and reports API errors', async ({ page, request }) => {
    const issue = await createIssue(request)
    await login(page, USERS.dev)
    await page.goto(`/issues/${issue.id}`)
    await linkPullRequests(page, [MR.other, 'https://gitlab.com/acme/platform/web/-/merge_requests/99'])
    await expect(panel(page).locator('.pr-errors')).toContainText('Could not load acme/platform/web!99 from GitLab (404 Not found).')

    await updateGitlabMergeRequest(request, 'acme/platform/web!21', {
      state: 'closed', closed_at: new Date().toISOString(),
    })
    await panel(page).getByRole('link', { name: 'Refresh from GitLab' }).click()
    const card = panel(page).locator('.pr')
    await expect(card).toHaveAttribute('data-status', 'closed')
    await expect(card.locator('.pr-summary')).toContainText("sidney's merge request was closed without merging")
  })

  test('rejects webhooks with a wrong token and ignores other events', async ({ request }) => {
    const payload = mergeRequestPayload('open', { iid: 300, title: 'Nope' })
    expect((await sendGitlabWebhook(request, payload, { token: 'wrong' })).status()).toBe(401)
    expect((await sendGitlabWebhook(request, payload, { token: '' })).status()).toBe(401)
    const push = await sendGitlabWebhook(request, { object_kind: 'push' }, { event: 'Push Hook' })
    expect((await push.json()).status).toBe('ignored')
  })

  test('webhook links, tracks and resolves issues on merge', async ({ page, request }) => {
    const fixed = await createIssue(request, { subject: 'Pipelines are slow' })
    const related = await createIssue(request, { subject: 'CI docs' })
    const iid = uniqueNumber()
    const options = {
      iid, title: 'Speed up pipelines', description: `Closes #${fixed.id}\n\nRelated to #${related.id}`, branch: 'faster-ci',
    }

    const opened = await sendGitlabWebhook(request, mergeRequestPayload('open', { ...options, draft: true, user: 'sidney' }))
    const result = await opened.json()
    expect(result.status).toBe('processed')
    expect(result.pull_request).toBe(`acme/platform/web!${iid}`)
    expect(result.linked_issues.sort()).toEqual([fixed.id, related.id].sort())

    await login(page, USERS.dev)
    await page.goto(`/issues/${fixed.id}`)
    const card = panel(page).locator('.pr')
    await expect(card).toHaveAttribute('data-status', 'draft')
    await expect(card.locator('.pr-number')).toHaveText(`!${iid}`)
    // not known to the API: details come from the payload only
    await expect(card.locator('.pr-summary')).toContainText('sidney wants to merge changes into main from faster-ci')

    await sendGitlabWebhook(request, mergeRequestPayload('update', { ...options, oldrev: 'abc123' }))
    await page.reload()
    await expect(card).toHaveAttribute('data-status', 'open')

    const merged = await sendGitlabWebhook(request, mergeRequestPayload('merge', { ...options, state: 'merged', user: 'tanuki' }))
    expect((await merged.json()).fixed_issues).toEqual([fixed.id])

    await page.reload()
    await expect(card).toHaveAttribute('data-status', 'merged')
    await expect(card.locator('.pr-summary')).toContainText('tanuki merged changes into main from faster-ci')
    await expect(page.locator('.issue .attributes .status .value')).toHaveText('Resolved')
    await expect(page.locator('#history')).toContainText(`Applied in merge request acme/platform/web!${iid}.`)
    expect((await getIssue(request, related.id)).status.name).toBe('New')
  })

  test('webhook loads missing details from the GitLab API', async ({ page, request }) => {
    const issue = await createIssue(request)
    // the payload user (who triggered the event) is not necessarily the author
    await sendGitlabWebhook(request, mergeRequestPayload('reopen', {
      iid: 21, title: 'Add review apps', description: `refs #${issue.id}`, branch: 'review-apps', user: 'tanuki',
    }))

    // loaded in the background after the webhook answered
    await login(page, USERS.dev)
    await page.goto(`/issues/${issue.id}`)
    await reloadUntil(page, () => expect(panel(page).locator('.pr-summary'))
      .toContainText('sidney wants to merge 6 commits into main from review-apps', { timeout: 500 }))
  })
})

test.describe('reviews, checks and comments', () => {
  test('shows GitHub reviewers, review decision, checks, comments and threads', async ({ page, request }) => {
    const issue = await createIssue(request)
    await login(page, USERS.dev)
    await page.goto(`/issues/${issue.id}`)
    await linkPullRequests(page, [PR.open, PR.draft, PR.merged, PR.closed])

    const open = panel(page).locator('.pr', { hasText: '#42' })
    const reviewers = open.locator('.pr-reviewer')
    await expect(reviewers).toHaveCount(3)
    await expect(reviewers.nth(0)).toHaveAttribute('title', 'monalisa approved these changes')
    await expect(reviewers.nth(1)).toHaveAttribute('title', 'hubot left review comments')
    await expect(reviewers.nth(2)).toHaveAttribute('title', 'Awaiting review from sidney')
    await expect(open.locator('.pr-decision')).toHaveText('Approved')
    const checks = open.locator('.pr-card__details .pr-checks')
    await expect(checks).toHaveText('3/4 checks passed')
    await expect(checks).toHaveClass(/pr-checks--pending/)
    await expect(checks).toHaveAttribute('href', `${PR.open}/checks`)
    await expect(checks).toHaveAttribute('title', '3 successful, 0 failing, 1 in progress')
    await expect(open.locator('.pr-comments')).toHaveText('12')
    await expect(open.locator('.pr-comments')).toHaveAttribute('title', '12 comments')
    await expect(open.locator('.pr-threads')).toHaveText('2 unresolved threads')

    const draft = panel(page).locator('.pr', { hasText: '#57' })
    await expect(draft.locator('.pr-card__details .pr-checks')).toHaveText('1 failing check')
    await expect(draft.locator('.pr-reviewer')).toHaveCount(0)
    await expect(draft.locator('.pr-decision')).toHaveCount(0)

    const merged = panel(page).locator('.pr', { hasText: '#108' })
    await expect(merged.locator('.pr-card__details .pr-checks')).toHaveText('6 checks passed')
    await expect(merged.locator('.pr-decision')).toHaveText('Approved')
    await expect(merged.locator('.pr-threads')).toHaveCount(0)

    const closed = panel(page).locator('.pr', { hasText: '#61' })
    await expect(closed.locator('.pr-card__details')).toHaveText('1')
  })

  test('GitHub review and checks webhooks refresh linked pull requests', async ({ page, request }) => {
    const issue = await createIssue(request)
    await login(page, USERS.dev)
    await page.goto(`/issues/${issue.id}`)
    await linkPullRequests(page, [PR.open])
    const card = panel(page).locator('.pr')
    await expect(card.locator('.pr-decision')).toHaveText('Approved')

    await updateGithubPullRequest(request, 'acme/web#42', {
      requested_reviewers: [],
      reviews: [{ user: { login: 'monalisa' }, state: 'APPROVED' }, { user: { login: 'sidney' }, state: 'CHANGES_REQUESTED' }],
      threads: [true, true, true],
    })
    const reviewed = await sendWebhook(request, {
      action: 'submitted', review: { state: 'changes_requested' },
      pull_request: { number: 42 }, repository: { full_name: 'acme/web' },
    }, { event: 'pull_request_review' })
    // the refresh is queued, the page shows it a moment later
    expect(await reviewed.json()).toEqual({ status: 'queued', pull_requests: ['acme/web#42'] })
    await reloadUntil(page, () => expect(card.locator('.pr-decision')).toHaveText('Changes requested', { timeout: 500 }))
    await expect(card.locator('.pr-reviewer').first()).toHaveAttribute('title', 'sidney requested changes')
    await expect(card.locator('.pr-threads')).toHaveCount(0)

    // check runs only know the head commit
    await updateGithubPullRequest(request, 'acme/web#42', {
      checkRuns: [{ name: 'build', status: 'completed', conclusion: 'success' }, { name: 'e2e', status: 'completed', conclusion: 'failure' }],
    })
    const checked = await sendWebhook(request, {
      action: 'completed', check_run: { head_sha: 'acme-web-42-sha', pull_requests: [] }, repository: { full_name: 'acme/web' },
    }, { event: 'check_run' })
    expect((await checked.json()).pull_requests).toEqual(['acme/web#42'])
    await reloadUntil(page, () => expect(card.locator('.pr-card__details .pr-checks')).toHaveText('1 failing check', { timeout: 500 }))

    await updateGithubPullRequest(request, 'acme/web#42', { statuses: [{ context: 'ci/jenkins', state: 'success' }],
      checkRuns: [{ name: 'build', status: 'completed', conclusion: 'success' }] })
    const status = await sendWebhook(request, { sha: 'acme-web-42-sha', state: 'success', repository: { full_name: 'acme/web' } }, { event: 'status' })
    expect((await status.json()).status).toBe('queued')
    await reloadUntil(page, () => expect(card.locator('.pr-card__details .pr-checks')).toHaveText('2 checks passed', { timeout: 500 }))

    const unknown = await sendWebhook(request, {
      action: 'submitted', pull_request: { number: 4242 }, repository: { full_name: 'acme/web' },
    }, { event: 'pull_request_review' })
    expect((await unknown.json()).status).toBe('ignored')
  })

  test('shows GitLab reviewers, approvals, pipeline and discussions', async ({ page, request }) => {
    const issue = await createIssue(request)
    await login(page, USERS.dev)
    await page.goto(`/issues/${issue.id}`)
    await linkPullRequests(page, [
      'https://gitlab.com/acme/platform/web/-/merge_requests/12', 'https://gitlab.com/acme/platform/web/-/merge_requests/21',
    ])

    const mr = panel(page).locator('.pr', { hasText: '!12' })
    await expect(mr.locator('.pr-reviewer')).toHaveCount(2)
    await expect(mr.locator('.pr-reviewer').nth(0)).toHaveAttribute('title', 'sidney requested changes')
    await expect(mr.locator('.pr-reviewer').nth(1)).toHaveAttribute('title', 'Awaiting review from hubot')
    await expect(mr.locator('.pr-decision')).toHaveText('Changes requested')
    await expect(mr.locator('.pr-card__details .pr-checks')).toHaveText('Pipeline running')
    await expect(mr.locator('.pr-card__details .pr-checks')).toHaveAttribute('href', 'https://gitlab.com/acme/platform/web/-/pipelines/1012')
    await expect(mr.locator('.pr-comments')).toHaveText('4')
    await expect(mr.locator('.pr-threads')).toHaveText('1 unresolved thread')

    const other = panel(page).locator('.pr', { hasText: '!21' })
    await expect(other.locator('.pr-decision')).toHaveText('Review required')
    await expect(other.locator('.pr-card__details .pr-checks')).toHaveText('Pipeline failed')
  })

  test('GitLab comment and pipeline webhooks refresh linked merge requests', async ({ page, request }) => {
    const issue = await createIssue(request)
    await login(page, USERS.dev)
    await page.goto(`/issues/${issue.id}`)
    await linkPullRequests(page, ['https://gitlab.com/acme/platform/web/-/merge_requests/12'])
    const card = panel(page).locator('.pr')
    await expect(card.locator('.pr-threads')).toHaveText('1 unresolved thread')

    await updateGitlabMergeRequest(request, 'acme/platform/web!12', {
      user_notes_count: 5, discussions: [{ notes: [{ resolvable: true, resolved: true }] }],
    })
    const note = await sendGitlabWebhook(request, {
      object_kind: 'note', project: { path_with_namespace: 'acme/platform/web' },
      object_attributes: { noteable_type: 'MergeRequest' }, merge_request: { iid: 12 },
    }, { event: 'Note Hook' })
    expect(await note.json()).toEqual({ status: 'queued', pull_requests: ['acme/platform/web!12'] })
    await reloadUntil(page, () => expect(card.locator('.pr-comments')).toHaveText('5', { timeout: 500 }))
    await expect(card.locator('.pr-threads')).toHaveCount(0)

    await updateGitlabMergeRequest(request, 'acme/platform/web!12', {
      head_pipeline: { status: 'success', web_url: 'https://gitlab.com/acme/platform/web/-/pipelines/2000' },
    })
    const pipeline = await sendGitlabWebhook(request, {
      object_kind: 'pipeline', project: { path_with_namespace: 'acme/platform/web' },
      object_attributes: { sha: 'acme-platform-web-12-sha', status: 'success' },
    }, { event: 'Pipeline Hook' })
    expect((await pipeline.json()).status).toBe('queued')
    await reloadUntil(page, () => expect(card.locator('.pr-card__details .pr-checks')).toHaveText('Pipeline passed', { timeout: 500 }))
  })
})

test.describe('administration', () => {
  test('plugin settings show the webhook URL', async ({ page, baseURL }) => {
    await login(page, USERS.admin)
    await page.goto('/settings/plugin/redmine_pull_requests')
    await expect(page.locator('.pr-webhook-url')).toHaveText([
      new URL('/pull_requests/github/webhook', baseURL).href, new URL('/pull_requests/gitlab/webhook', baseURL).href,
    ])
    await expect(page.locator('#settings_gitlab_api_url')).toHaveValue('http://mock-api:4010/api/v4')
    await expect(page.locator('#settings_github_api_url')).toHaveValue('http://mock-api:4010')
    await expect(page.locator('#settings_link_bare_refs')).toBeChecked()

    await page.locator('#settings_link_branch_refs').uncheck()
    await page.getByRole('button', { name: 'Apply' }).click()
    await expect(page.locator('#flash_notice')).toBeVisible()
    await expect(page.locator('#settings_link_branch_refs')).not.toBeChecked()

    await page.locator('#settings_link_branch_refs').check()
    await page.getByRole('button', { name: 'Apply' }).click()
    await expect(page.locator('#settings_link_branch_refs')).toBeChecked()
  })
})
