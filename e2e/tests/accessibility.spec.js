import { test, expect } from '@playwright/test'
import { USERS, createIssue, linkPullRequests, login, panel, resetMockApi, updateGithubPullRequest } from './helpers.js'

// Accessible names, keyboard focus, small screens and print of the panel

const PR = {
  open: 'https://github.com/acme/web/pull/42',
  merged: 'https://github.com/acme/api/pull/108',
  draft: 'https://github.com/acme/web/pull/57',
  closed: 'https://github.com/acme/web/pull/61',
}

test.beforeEach(async ({ page, request }) => {
  await resetMockApi(request)
  await login(page, USERS.dev)
})

test.describe('header', () => {
  test('the link action is styled the same on every Redmine version', async ({ page, request }) => {
    const issue = await createIssue(request)
    await page.goto(`/issues/${issue.id}`)

    const link = panel(page).getByRole('link', { name: 'Link pull request', exact: true })
    await expect(link).toHaveClass(/pr-header__action/)
    // a flex item of the header actions, so inline-flex is computed as flex
    await expect(link).toHaveCSS('display', /^(inline-)?flex$/)
    await expect(link).toHaveCSS('white-space', 'nowrap')
    // icon and label are centred on one line
    const icon = await link.locator('svg').boundingBox()
    const box = await link.boundingBox()
    expect(Math.abs(icon.y + icon.height / 2 - (box.y + box.height / 2))).toBeLessThanOrEqual(2)
    // Redmine 6+: the icon exists in the sprite of this version
    const use = link.locator('svg use')
    if (await use.count()) {
      const [url, id] = (await use.getAttribute('href')).split('#')
      expect(await (await page.request.get(url)).text()).toContain(`id="${id}"`)
    }
  })

  test('the link form is announced as expanded and cancel returns the focus', async ({ page, request }) => {
    const issue = await createIssue(request)
    await page.goto(`/issues/${issue.id}`)

    const link = panel(page).getByRole('link', { name: 'Link pull request', exact: true })
    await expect(link).toHaveAttribute('aria-controls', 'new-pull-request-form')
    await expect(link).toHaveAttribute('aria-expanded', 'false')
    await link.click()
    await expect(link).toHaveAttribute('aria-expanded', 'true')
    await expect(page.locator('#pull_request_url')).toBeFocused()

    await page.locator('#new-pull-request-form').getByRole('link', { name: 'Cancel' }).click()
    await expect(page.locator('#new-pull-request-form')).toBeHidden()
    await expect(link).toHaveAttribute('aria-expanded', 'false')
    await expect(link).toBeFocused()
  })

  test('wraps on small screens', async ({ page, request }) => {
    const issue = await createIssue(request)
    await page.setViewportSize({ width: 360, height: 800 })
    await page.goto(`/issues/${issue.id}`)
    await linkPullRequests(page, [PR.open, PR.merged, PR.draft, PR.closed])
    await expect(panel(page).locator('.pr')).toHaveCount(4)

    const header = panel(page).locator('.pr-header')
    const { scrollWidth, clientWidth } = await header.evaluate((el) => ({ scrollWidth: el.scrollWidth, clientWidth: el.clientWidth }))
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth)
    const link = await panel(page).getByRole('link', { name: 'Link pull request', exact: true }).boundingBox()
    expect(link.x + link.width).toBeLessThanOrEqual(360)
  })
})

test.describe('accessible names', () => {
  test('status, counters and compact indicators are named', async ({ page, request }) => {
    const issue = await createIssue(request)
    await page.goto(`/issues/${issue.id}`)
    await linkPullRequests(page, [PR.open, PR.merged, PR.draft, PR.closed])

    const header = panel(page).locator('.pr-heading')
    for (const name of ['Open: 1', 'Draft: 1', 'Merged: 1', 'Closed: 1']) {
      await expect(header.getByRole('img', { name, exact: true })).toBeVisible()
    }

    const row = panel(page).locator('.pr', { hasText: '#42' })
    await expect(row.getByRole('img', { name: 'Open', exact: true })).toBeVisible()
    await expect(row.getByRole('img', { name: 'Approved', exact: true })).toBeVisible()
    await expect(row.getByRole('img', { name: '12 comments', exact: true })).toBeVisible()
    await expect(row.getByRole('img', { name: '2 unresolved threads', exact: true })).toBeVisible()
    await expect(row.locator('.pr-compact-indicators').getByRole('link', { name: '3/4 checks passed' })).toBeVisible()
    // approval and passed checks look different
    const merged = panel(page).locator('.pr', { hasText: '#108' })
    await expect(merged.locator('.pr-compact-indicators .octicon')).toHaveClass([/octicon-check-circle/, /octicon-check$/, /octicon-comment/])

    // every row has its own toggle
    await expect(panel(page).getByRole('button', { name: /^Show details for / })).toHaveCount(4)
    const toggle = row.getByRole('button', { name: 'Show details for acme/web#42', exact: true })
    await toggle.click()
    await expect(row.getByRole('button', { name: 'Hide details for acme/web#42', exact: true })).toHaveAttribute('aria-expanded', 'true')
    await expect(row.getByRole('link', { name: 'GitHub: acme/web', exact: true })).toBeVisible()
    await expect(row.getByRole('img', { name: 'monalisa approved these changes', exact: true })).toBeVisible()
  })

  test('the view toggle names the action and has no pressed state', async ({ page, request }) => {
    const issue = await createIssue(request)
    await page.goto(`/issues/${issue.id}`)
    await linkPullRequests(page, [PR.open, PR.merged])

    const toggle = panel(page).locator('[data-pr-view-toggle]')
    await expect(toggle).toHaveAccessibleName('Expand all')
    await expect(toggle).not.toHaveAttribute('aria-pressed')
    await toggle.click()
    await expect(toggle).toHaveAccessibleName('Compact view')
    await expect(toggle).not.toHaveAttribute('aria-pressed')
  })
})

test.describe('focus after updates', () => {
  test('refresh keeps the focus on the refresh button', async ({ page, request }) => {
    const issue = await createIssue(request)
    await page.goto(`/issues/${issue.id}`)
    await linkPullRequests(page, [PR.open, PR.merged])

    const row = panel(page).locator('.pr', { hasText: '#42' })
    await row.getByRole('button', { name: 'Show details' }).click()
    await row.getByRole('link', { name: 'Refresh from GitHub' }).focus()
    await Promise.all([
      page.waitForResponse((r) => r.url().endsWith('/refresh')),
      page.keyboard.press('Enter'),
    ])
    await expect(panel(page).locator('.pr', { hasText: '#42' }).getByRole('link', { name: 'Refresh from GitHub' })).toBeFocused()
  })

  test('unlink moves the focus to the next pull request, then to the link action', async ({ page, request }) => {
    const issue = await createIssue(request)
    await page.goto(`/issues/${issue.id}`)
    await linkPullRequests(page, [PR.open, PR.merged, PR.closed])
    await expect(panel(page).locator('.pr-number')).toHaveText(['#42', '#108', '#61'])

    page.on('dialog', (dialog) => dialog.accept())
    const row = panel(page).locator('.pr', { hasText: '#108' })
    await row.getByRole('button', { name: 'Show details' }).click()
    await row.getByRole('link', { name: 'Unlink pull request' }).click()
    await expect(panel(page).locator('.pr')).toHaveCount(2)
    await expect(panel(page).getByRole('button', { name: 'Show details for acme/web#61' })).toBeFocused()

    // a single pull request is a full card: its title
    await panel(page).locator('.pr', { hasText: '#61' }).getByRole('button', { name: 'Show details' }).click()
    await panel(page).locator('.pr', { hasText: '#61' }).getByRole('link', { name: 'Unlink pull request' }).click()
    await expect(panel(page).locator('.pr')).toHaveCount(1)
    await expect(panel(page).locator('.pr-title')).toBeFocused()

    await panel(page).getByRole('link', { name: 'Unlink pull request' }).click()
    await expect(panel(page).locator('.pr')).toHaveCount(0)
    await expect(panel(page).getByRole('link', { name: 'Link pull request', exact: true })).toBeFocused()
  })

  test('linking returns the focus to the link action, errors to the field', async ({ page, request }) => {
    const issue = await createIssue(request)
    await page.goto(`/issues/${issue.id}`)
    await linkPullRequests(page, [PR.open])
    await expect(panel(page).getByRole('link', { name: 'Link pull request', exact: true })).toBeFocused()

    await linkPullRequests(page, ['https://example.com/nope'])
    await expect(page.locator('#pull_request_url')).toBeFocused()
  })
})

test.describe('wording', () => {
  test('pluralizes the changed files and names unknown users', async ({ page, request }) => {
    await updateGithubPullRequest(request, 'acme/api#108', { changed_files: 1, merged_by: null, user: null })
    const issue = await createIssue(request)
    await page.goto(`/issues/${issue.id}`)
    await linkPullRequests(page, [PR.merged])

    const card = panel(page).locator('.pr')
    await expect(card.locator('.pr-diff')).toHaveAttribute('title', '1 file changed')
    await expect(card.locator('.pr-summary')).toContainText('someone merged 3 commits into main')
  })

  test('the fixing keywords hint links to the repository settings', async ({ browser }) => {
    const page = await browser.newPage()
    await login(page, USERS.admin)
    await page.goto('/settings/plugin/redmine_pull_requests')
    const hint = page.locator('p', { has: page.locator('#settings_apply_fix_keywords') }).locator('em.info')
    await expect(hint).toHaveText('When a pull request referencing "fixes #123" is merged, the issue is updated like by a commit. ' +
      'See Fixing keywords in the repository settings.')
    await expect(hint.getByRole('link', { name: 'Fixing keywords' })).toHaveAttribute('href', /tab=repositories/)
  })
})

test('print shows every pull request with its details and no buttons', async ({ page, request }) => {
  const issue = await createIssue(request)
  await page.goto(`/issues/${issue.id}`)
  await linkPullRequests(page, [PR.open, PR.merged])
  await expect(panel(page).locator('.pr-list')).toHaveClass(/pr-list--compact/)

  await page.emulateMedia({ media: 'print' })
  await expect(panel(page).locator('.pr-card__body')).toHaveCount(2)
  for (const body of await panel(page).locator('.pr-card__body').all()) await expect(body).toBeVisible()
  await expect(panel(page).locator('.pr-state').first()).toBeVisible()
  await expect(panel(page).locator('.pr-toggle').first()).toBeHidden()
  await expect(panel(page).locator('.pr-header__actions')).toBeHidden()
  await expect(panel(page).locator('.pr-compact-indicators').first()).toBeHidden()
})
