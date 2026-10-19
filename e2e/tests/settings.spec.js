import { test, expect } from '@playwright/test'
import { API_KEYS, USERS, createIssue, login, sendGitlabWebhook, sendWebhook } from './helpers.js'

const SECRETS = ['e2e-github-token', 'e2e-webhook-secret', 'e2e-gitlab-token', 'e2e-gitlab-secret']

async function gitlabPing(request) {
  return (await sendGitlabWebhook(request, { object_kind: 'push' }, { event: 'Push Hook' })).status()
}

test.describe('plugin settings', () => {
  test('stored secrets are not shown and kept when left blank', async ({ page, request }) => {
    await login(page, USERS.admin)
    await page.goto('/settings/plugin/redmine_pull_requests')
    const html = await page.content()
    for (const secret of SECRETS) expect(html).not.toContain(secret)
    for (const field of ['github_token', 'github_webhook_secret', 'gitlab_token', 'gitlab_webhook_secret']) {
      await expect(page.locator(`#settings_${field}`)).toHaveValue('')
    }
    await expect(page.locator('#settings_github_token ~ .info').first()).toHaveText('A value is stored. Leave blank to keep it.')

    await page.getByRole('button', { name: 'Apply' }).click()
    await expect(page.locator('#flash_notice')).toBeVisible()
    expect((await sendWebhook(request, { zen: 'kept' }, { event: 'ping' })).status()).toBe(200)
    expect(await gitlabPing(request)).toBe(200)

    try {
      // "Remove" clears a secret
      await page.locator('#clear_settings_gitlab_webhook_secret').check()
      await page.getByRole('button', { name: 'Apply' }).click()
      await expect(page.locator('#flash_notice')).toBeVisible()
      await expect(page.locator('#clear_settings_gitlab_webhook_secret')).toHaveCount(0)
      expect(await gitlabPing(request)).toBe(403)
    } finally {
      await page.goto('/settings/plugin/redmine_pull_requests')
      await page.locator('#settings_gitlab_webhook_secret').fill('e2e-gitlab-secret')
      await page.getByRole('button', { name: 'Apply' }).click()
      await expect(page.locator('#flash_notice')).toBeVisible()
    }
    expect(await gitlabPing(request)).toBe(200)
    expect(await page.content()).not.toContain('e2e-gitlab-secret')
  })
})

test.describe('self-managed GitLab', () => {
  test('supports a relative URL root', async ({ page, request }) => {
    const setWebUrl = async (url) => {
      await page.goto('/settings/plugin/redmine_pull_requests')
      await page.locator('#settings_gitlab_web_url').fill(url)
      await page.getByRole('button', { name: 'Apply' }).click()
      await expect(page.locator('#flash_notice')).toBeVisible()
    }
    await login(page, USERS.admin)
    const issue = await createIssue(request)
    await setWebUrl('https://git.example.com/gitlab/')
    try {
      const response = await request.post(`/issues/${issue.id}/pull_requests.json`, {
        headers: { 'X-Redmine-API-Key': API_KEYS.dev },
        data: { pull_request: { url: 'https://git.example.com/gitlab/acme/platform/web/-/merge_requests/12' } },
      })
      expect(response.status()).toBe(201)
      expect((await response.json()).pull_requests[0].reference).toBe('acme/platform/web!12')
    } finally {
      await setWebUrl('https://gitlab.com')
    }
  })
})
