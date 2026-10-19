import { test, expect } from '@playwright/test'
import {
  API_KEYS, USERS, createIssue, createProject, csrfToken, getIssue, login, mergeRequestPayload, panel,
  pullRequestPayload, resetMockApi, sendGitlabWebhook, sendWebhook, uniqueNumber,
} from './helpers.js'

// The seed allows github:acme/web, github:acme/api and gitlab:acme/platform/**
// in "acme", github:acme/secret in "secret" and nothing in "unconfigured".

test.beforeEach(async ({ request }) => {
  await resetMockApi(request)
})

test.describe('repository allow-list', () => {
  test('webhooks only link and fix issues of projects that allow the repository', async ({ request }) => {
    const [acme, secret] = await Promise.all([createIssue(request), createIssue(request, { project: 'secret' })])
    const body = `Fixes #${acme.id} and fixes #${secret.id}`

    // a fork or an unknown repository can't link anything
    const fork = await sendWebhook(request, pullRequestPayload('opened', { repo: 'evil/fork', number: uniqueNumber(), title: 'Spam', body }))
    expect(await fork.json()).toMatchObject({ status: 'ignored', linked_issues: [] })

    const number = uniqueNumber()
    const options = { repo: 'acme/secret', number, title: 'Secret fix', body }
    const opened = await sendWebhook(request, pullRequestPayload('opened', options))
    expect(await opened.json()).toMatchObject({ status: 'processed', linked_issues: [secret.id] })

    const merged = await sendWebhook(request, pullRequestPayload('closed', { ...options, state: 'closed', merged: true }))
    expect((await merged.json()).fixed_issues).toEqual([secret.id])
    expect((await getIssue(request, secret.id)).status.name).toBe('Resolved')
    expect((await getIssue(request, acme.id)).status.name).toBe('New')
  })

  test('patterns match GitLab subgroups and are provider specific', async ({ request }) => {
    const issue = await createIssue(request)
    const description = `refs #${issue.id}`
    const subgroup = await sendGitlabWebhook(request, mergeRequestPayload('open', {
      project: 'acme/platform/tools/cli', iid: uniqueNumber(), title: 'CLI', description,
    }))
    expect((await subgroup.json()).linked_issues).toEqual([issue.id])

    // only allowed on GitHub
    const gitlab = await sendGitlabWebhook(request, mergeRequestPayload('open', {
      project: 'acme/web', iid: uniqueNumber(), title: 'Web', description,
    }))
    expect((await gitlab.json()).status).toBe('ignored')
  })

  test('only the first 50 references of an event are processed', async ({ request }) => {
    const issue = await createIssue(request)
    const unknown = Array.from({ length: 50 }, (_, i) => `#${900_000_000 + i}`).join(' ')
    const response = await sendWebhook(request, pullRequestPayload('opened', {
      number: uniqueNumber(), title: 'Many references', body: `${unknown} #${issue.id}`,
    }))
    expect(await response.json()).toMatchObject({ status: 'ignored', linked_issues: [] })
  })

  test('the panel explains that no repository is allowed', async ({ browser, request }) => {
    const issue = await createIssue(request, { project: 'unconfigured' })

    const devPage = await browser.newPage()
    await login(devPage, USERS.dev)
    await devPage.goto(`/issues/${issue.id}`)
    await expect(panel(devPage).locator('.pr-repositories-hint')).toHaveText(
      "No repositories are allowed in this project yet, so pull requests can't be linked. A project manager can allow them in the project settings.",
    )
    await expect(panel(devPage).getByRole('link', { name: 'Configure repositories' })).toHaveCount(0)

    const managerPage = await browser.newPage()
    await login(managerPage, USERS.manager)
    await managerPage.goto(`/issues/${issue.id}`)
    const link = panel(managerPage).getByRole('link', { name: 'Configure repositories' })
    await expect(link).toHaveAttribute('href', '/projects/unconfigured/settings/pull_requests')
    await link.click()
    await expect(managerPage.locator('#tab-pull_requests')).toHaveClass(/selected/)

    // configured projects show no hint
    const acme = await createIssue(request)
    await devPage.goto(`/issues/${acme.id}`)
    await expect(panel(devPage).locator('.pr-repositories-hint')).toHaveCount(0)
  })
})

test.describe('project settings', () => {
  test('saves and validates the allowed repositories', async ({ page, request }) => {
    const project = await createProject(request)
    await login(page, USERS.manager)
    await page.goto(`/projects/${project.identifier}/settings/pull_requests`)
    const field = page.getByLabel('Allowed repositories')
    await expect(field).toHaveValue('')

    await field.fill('# comment\ngithub:acme/web\nbitbucket:acme/web\nacme/**/web\n\nacme')
    await page.getByRole('button', { name: 'Save' }).click()
    await expect(page.locator('#errorExplanation li')).toHaveText([
      'Line 3: "bitbucket:acme/web" is not a valid repository pattern.',
      'Line 4: "acme/**/web" is not a valid repository pattern.',
      'Line 6: "acme" is not a valid repository pattern.',
    ])
    // the input is kept for corrections
    await expect(field).toHaveValue('# comment\ngithub:acme/web\nbitbucket:acme/web\nacme/**/web\n\nacme')

    await field.fill('# comment\ngithub:ACME/web\ngitlab:acme/**')
    await page.getByRole('button', { name: 'Save' }).click()
    await expect(page.locator('#flash_notice')).toBeVisible()
    await expect(page).toHaveURL(new RegExp(`/projects/${project.identifier}/settings/pull_requests$`))
    await expect(page.getByLabel('Allowed repositories')).toHaveValue('# comment\ngithub:ACME/web\ngitlab:acme/**')

    const issue = await createIssue(request, { project: project.identifier })
    const response = await request.post(`/issues/${issue.id}/pull_requests.json`, {
      headers: { 'X-Redmine-API-Key': API_KEYS.manager },
      data: { pull_request: { urls: ['https://github.com/acme/web/pull/42', 'https://gitlab.com/acme/platform/web/-/merge_requests/12'] } },
    })
    expect(response.status()).toBe(201)
  })

  test('needs the "Manage pull request settings" permission and the module', async ({ browser }) => {
    const managerPage = await browser.newPage()
    await login(managerPage, USERS.manager)
    await managerPage.goto('/projects/acme/settings')
    await expect(managerPage.locator('#tab-pull_requests')).toHaveText('Pull requests')
    // the module is disabled in legacy
    await managerPage.goto('/projects/legacy/settings')
    await expect(managerPage.locator('#tab-info')).toBeVisible()
    await expect(managerPage.locator('#tab-pull_requests')).toHaveCount(0)

    // developers may manage versions, but not the pull request settings
    const devPage = await browser.newPage()
    await login(devPage, USERS.dev)
    await devPage.goto('/projects/acme/settings/pull_requests')
    await expect(devPage.locator('#tab-versions')).toBeVisible()
    await expect(devPage.locator('#tab-pull_requests')).toHaveCount(0)
    const response = await devPage.request.patch('/projects/acme/pull_request_settings', {
      form: { repositories: 'evil/*' }, headers: { 'X-CSRF-Token': await csrfToken(devPage) },
    })
    expect(response.status()).toBe(403)

    // CSRF protected (Redmine logs the user out)
    const forged = await managerPage.request.patch('/projects/acme/pull_request_settings', { form: { repositories: 'evil/*' } })
    expect(forged.status()).toBe(422)
    await login(managerPage, USERS.manager)
    await managerPage.goto('/projects/acme/settings/pull_requests')
    await expect(managerPage.getByLabel('Allowed repositories')).toHaveValue(/github:acme\/web/)
    await expect(managerPage.getByLabel('Allowed repositories')).not.toHaveValue(/evil/)
  })
})

test.describe('linking without JavaScript', () => {
  test('errors in the flash message are escaped', async ({ page, request }) => {
    const issue = await createIssue(request)
    await login(page, USERS.dev)
    await page.goto(`/issues/${issue.id}`)
    const response = await page.request.post(`/issues/${issue.id}/pull_requests`, {
      form: { url: '<img/src=x/onerror=alert(1)>' }, headers: { 'X-CSRF-Token': await csrfToken(page), Accept: 'text/html' },
    })
    expect(response.ok()).toBeTruthy()
    // the flash is shown on the issue page the request redirected to
    const html = await response.text()
    expect(html).toContain('&lt;img/src=x/onerror=alert(1)&gt; is not a GitHub pull request')
    expect(html).not.toContain('<img/src=x')
  })
})
