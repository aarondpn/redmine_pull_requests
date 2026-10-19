import { test, expect } from '@playwright/test'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  ADMIN_API_KEY, USERS, linkPullRequests, login, panel, pullRequestPayload, resetMockApi, sendWebhook,
} from './helpers.js'

// Captures the images used in the README: npm run screenshots
// Screens are taken at 2x and framed (window mockup on a gradient) in a
// second step, the demo GIF is converted from a recorded video with ffmpeg.

const DOCS = new URL('../../docs/', import.meta.url).pathname
const PRS = {
  github42: 'https://github.com/acme/web/pull/42',
  github57: 'https://github.com/acme/web/pull/57',
  github61: 'https://github.com/acme/web/pull/61',
  github108: 'https://github.com/acme/api/pull/108',
  gitlab12: 'https://gitlab.com/acme/platform/web/-/merge_requests/12',
}

test.use({ deviceScaleFactor: 2, viewport: { width: 1280, height: 900 } })
test.describe.configure({ mode: 'serial' })
test.setTimeout(120_000)

async function apiGet(request, path) {
  const response = await request.get(path, { headers: { 'X-Redmine-API-Key': ADMIN_API_KEY } })
  return response.json()
}

// A realistic looking issue: feature with priority, assignee, dates and progress
async function createShowcaseIssue(request, subject, description) {
  const [{ users }, { trackers }, { issue_priorities: priorities }] = await Promise.all([
    apiGet(request, '/users.json?name=dev'),
    apiGet(request, '/trackers.json'),
    apiGet(request, '/enumerations/issue_priorities.json'),
  ])
  const today = new Date()
  const date = (days) => new Date(today.getTime() + days * 86400e3).toISOString().slice(0, 10)
  const response = await request.post('/issues.json', {
    headers: { 'X-Redmine-API-Key': ADMIN_API_KEY },
    data: {
      issue: {
        project_id: 'acme',
        subject,
        description,
        tracker_id: trackers.find((t) => t.name === 'Feature').id,
        priority_id: priorities.find((p) => p.name === 'High').id,
        assigned_to_id: users[0].id,
        start_date: date(-6),
        due_date: date(8),
        estimated_hours: 24,
        done_ratio: 60,
      },
    },
  })
  expect(response.status()).toBe(201)
  return (await response.json()).issue
}

const pngSize = (file) => {
  const png = readFileSync(file)
  return { width: png.readUInt32BE(16), height: png.readUInt32BE(20) }
}

// Puts a 2x screenshot into a browser window mockup on a gradient
async function frame(browser, source, target, { url, padding = 56, chrome = true }) {
  const { width } = pngSize(source)
  const image = readFileSync(source).toString('base64')
  const page = await browser.newPage({ deviceScaleFactor: 2, viewport: { width: width / 2 + padding * 2, height: 800 } })
  await page.setContent(`
    <style>
      * { box-sizing: border-box; }
      body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
      .canvas {
        display: inline-block;
        padding: ${padding}px;
        background:
          radial-gradient(circle at 15% 20%, rgba(255, 255, 255, 0.28), transparent 45%),
          linear-gradient(135deg, #6d28d9 0%, #8250df 35%, #2563eb 75%, #0ea5e9 100%);
      }
      .window {
        overflow: hidden;
        border-radius: 12px;
        background: #fff;
        box-shadow: 0 30px 70px rgba(15, 23, 42, 0.45), 0 0 0 1px rgba(255, 255, 255, 0.15);
      }
      .bar {
        position: relative;
        display: flex;
        align-items: center;
        gap: 8px;
        height: 40px;
        padding: 0 16px;
        border-bottom: 1px solid #e5e7eb;
        background: #f6f7f9;
      }
      .dot { width: 12px; height: 12px; border-radius: 50%; }
      .url {
        position: absolute;
        left: 50%;
        transform: translateX(-50%);
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 5px 14px;
        border-radius: 8px;
        background: #e9ebef;
        color: #4b5563;
        font-size: 13px;
      }
      img { display: block; width: ${width / 2}px; }
    </style>
    <div class="canvas"><div class="window">
      ${chrome ? `<div class="bar">
        <span class="dot" style="background:#ff5f57"></span>
        <span class="dot" style="background:#febc2e"></span>
        <span class="dot" style="background:#28c840"></span>
        <span class="url">🔒 ${url}</span>
      </div>` : ''}
      <img src="data:image/png;base64,${image}">
    </div></div>`)
  await page.locator('.canvas').screenshot({ path: target })
  await page.close()
}

// Screenshot of an element with some room around it
async function shoot(page, locator, path, { padding = 16, top } = {}) {
  const box = await locator.boundingBox()
  const y = top ?? box.y - padding
  await page.screenshot({
    path,
    clip: { x: box.x - padding, y, width: box.width + padding * 2, height: box.y + box.height + padding - y },
  })
}

test('issue page and feature screenshots', async ({ page, request, browser }) => {
  const tmp = mkdtempSync(join(tmpdir(), 'pr-shots-'))
  await resetMockApi(request)
  await login(page, USERS.dev)

  // Hero: the whole issue page with a compact list and one expanded row
  const issue = await createShowcaseIssue(request, 'Users can sign in with GitHub and Google',
    'Add OAuth login next to the password login.\n\n* GitHub and Google as providers\n* Link existing accounts by e-mail\n* Rate-limit the public API endpoints used by the login flow')
  await page.setViewportSize({ width: 1280, height: 1600 })
  await page.goto(`/issues/${issue.id}`)
  await linkPullRequests(page, [PRS.github57, PRS.gitlab12, PRS.github42, PRS.github108, PRS.github61])
  await expect(panel(page).locator('.pr')).toHaveCount(5)
  await panel(page).locator('.pr', { hasText: '#42' }).getByRole('button', { name: 'Show details' }).click()
  await page.mouse.move(0, 0)
  await page.waitForTimeout(300) // chevron animation
  const panelBox = await panel(page).boundingBox()
  await page.screenshot({
    path: join(tmp, 'hero.png'),
    clip: { x: 0, y: 0, width: 1280, height: panelBox.y + panelBox.height + 32 },
  })
  await frame(browser, join(tmp, 'hero.png'), `${DOCS}hero.png`, { url: `redmine.example.com/issues/${issue.id}` })

  // the separator above the panel would show up as a line at the top of the crops
  await page.addStyleTag({ content: '.pull-requests-hook > hr { visibility: hidden; }' })

  // Compact list with GitHub and GitLab
  await panel(page).locator('.pr', { hasText: '#42' }).getByRole('button', { name: 'Hide details' }).click()
  await page.mouse.move(0, 0)
  await page.waitForTimeout(300)
  await shoot(page, panel(page), join(tmp, 'compact.png'))
  await frame(browser, join(tmp, 'compact.png'), `${DOCS}compact.png`, { chrome: false, padding: 40 })

  // All details of a single pull request
  const single = await createShowcaseIssue(request, 'Sign in with GitHub', 'OAuth login with GitHub.')
  await page.goto(`/issues/${single.id}`)
  await page.addStyleTag({ content: '.pull-requests-hook > hr { visibility: hidden; }' })
  await linkPullRequests(page, [PRS.github42])
  await page.mouse.move(0, 0)
  await shoot(page, panel(page), join(tmp, 'details.png'))
  await frame(browser, join(tmp, 'details.png'), `${DOCS}details.png`, { chrome: false, padding: 40 })

  // Linking by URL
  await panel(page).getByRole('link', { name: 'Link pull request', exact: true }).click()
  await page.locator('#pull_request_url').fill(`${PRS.gitlab12} ${PRS.github108}`)
  await page.mouse.move(0, 0)
  await shoot(page, panel(page), join(tmp, 'link.png'))
  await frame(browser, join(tmp, 'link.png'), `${DOCS}link.png`, { chrome: false, padding: 40 })

  // Fixing keyword: the merged pull request resolved the issue
  const fixed = await createShowcaseIssue(request, 'Password reset e-mails are not sent', 'Users never receive the reset link.')
  const options = {
    number: 950, title: 'Send password reset e-mails through the mail queue',
    body: `Fixes #${fixed.id}`, branch: 'fix/password-reset-mails',
  }
  await sendWebhook(request, pullRequestPayload('opened', options))
  await sendWebhook(request, pullRequestPayload('closed', { ...options, state: 'closed', merged: true }))
  await page.goto(`/issues/${fixed.id}`)
  await page.addStyleTag({ content: '.pull-requests-hook > hr { visibility: hidden; }' })
  await page.mouse.move(0, 0)
  const attributes = await page.locator('.issue .attributes').boundingBox()
  const journal = await page.locator('#history .journal').first().boundingBox()
  await page.screenshot({
    path: join(tmp, 'webhook.png'),
    clip: { x: attributes.x - 16, y: attributes.y - 12, width: attributes.width + 32, height: journal.y + journal.height + 12 - attributes.y },
  })
  await frame(browser, join(tmp, 'webhook.png'), `${DOCS}webhook.png`, { chrome: false, padding: 40 })

  rmSync(tmp, { recursive: true })
})

test('demo GIF', async ({ browser, request }) => {
  const tmp = mkdtempSync(join(tmpdir(), 'pr-demo-'))
  await resetMockApi(request)
  const issue = await createShowcaseIssue(request, 'Users can sign in with GitHub and Google',
    'Add OAuth login next to the password login.')

  // log in and collapse the sidebar (remembered in localStorage) outside of the recording
  const setup = await browser.newContext()
  const setupPage = await setup.newPage()
  await login(setupPage, USERS.dev)
  await setupPage.goto(`/issues/${issue.id}`)
  if (await setupPage.locator('#sidebar-switch-button').isVisible()) await setupPage.locator('#sidebar-switch-button').click()
  const storageState = await setup.storageState()
  await setup.close()

  const size = { width: 1040, height: 720 }
  const context = await browser.newContext({
    storageState, viewport: size, deviceScaleFactor: 1, recordVideo: { dir: tmp, size },
  })
  const page = await context.newPage()
  await page.goto(`/issues/${issue.id}`)
  await page.evaluate(() => window.scrollTo(0, document.querySelector('#content h2').getBoundingClientRect().top - 16))
  await page.waitForTimeout(1000)

  // link two pull requests by pasting their URLs
  await panel(page).getByRole('link', { name: 'Link pull request', exact: true }).click()
  await page.waitForTimeout(400)
  await page.locator('#pull_request_url').pressSequentially(`${PRS.github42} ${PRS.gitlab12}`, { delay: 12 })
  await page.waitForTimeout(400)
  await page.locator('#new-pull-request-form').getByRole('button', { name: 'Link' }).click()
  await expect(panel(page).locator('.pr')).toHaveCount(2)
  await page.mouse.move(520, 200)
  await page.waitForTimeout(1300)

  // one more
  await linkPullRequests(page, [PRS.github108])
  await expect(panel(page).locator('.pr')).toHaveCount(3)
  await page.mouse.move(520, 200)
  await page.waitForTimeout(1300)

  // expand a row
  const row = panel(page).locator('.pr', { hasText: '#42' })
  await row.locator('.pr-title').hover()
  await page.waitForTimeout(500)
  await row.locator('.pr-compact-repo').click()
  await page.mouse.move(520, 200)
  await page.waitForTimeout(2400)

  // expand all (scrolling along so the cards fit), then back to the compact view
  await panel(page).getByRole('button', { name: 'Expand all' }).click()
  await page.waitForTimeout(500)
  await page.evaluate(() => window.scrollBy({ top: 200, behavior: 'smooth' }))
  await page.waitForTimeout(2400)
  await panel(page).getByRole('button', { name: 'Compact view' }).click()
  await page.evaluate(() => window.scrollBy({ top: -200, behavior: 'smooth' }))
  await page.mouse.move(520, 200)
  await page.waitForTimeout(1600)

  const video = await page.video().path()
  await context.close()

  // Window frame on a gradient, the video is placed into its content area
  const scale = 0.85
  const inner = { width: Math.round(size.width * scale / 2) * 2, height: Math.round(size.height * scale / 2) * 2 }
  const padding = 40
  const bar = 34
  const bg = await browser.newPage({ deviceScaleFactor: 1, viewport: { width: inner.width + padding * 2, height: 600 } })
  await bg.setContent(`
    <style>
      body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
      .canvas {
        display: inline-block;
        padding: ${padding}px;
        background:
          radial-gradient(circle at 15% 20%, rgba(255, 255, 255, 0.28), transparent 45%),
          linear-gradient(135deg, #6d28d9 0%, #8250df 35%, #2563eb 75%, #0ea5e9 100%);
      }
      .window { overflow: hidden; border-radius: 10px; background: #fff; box-shadow: 0 24px 50px rgba(15, 23, 42, 0.45); }
      .bar { position: relative; display: flex; align-items: center; gap: 7px; height: ${bar}px; padding: 0 14px; background: #f6f7f9; }
      .dot { width: 11px; height: 11px; border-radius: 50%; }
      .url { position: absolute; left: 50%; transform: translateX(-50%); padding: 4px 12px; border-radius: 7px;
             background: #e9ebef; color: #4b5563; font-size: 12px; }
      .screen { width: ${inner.width}px; height: ${inner.height}px; }
      .foot { height: 8px; }
    </style>
    <div class="canvas"><div class="window">
      <div class="bar">
        <span class="dot" style="background:#ff5f57"></span>
        <span class="dot" style="background:#febc2e"></span>
        <span class="dot" style="background:#28c840"></span>
        <span class="url">🔒 redmine.example.com/issues/${issue.id}</span>
      </div>
      <div class="screen"></div><div class="foot"></div>
    </div></div>`)
  await bg.locator('.canvas').screenshot({ path: join(tmp, 'frame.png') })
  await bg.close()

  // 2-pass palette for clean colors, skip the first frames (page load).
  // mpdecimate drops the frames in which nothing moves (the GIF keeps their
  // time as a longer delay), which halves the file size. The last pause is
  // set with final_delay, as it has no following frame to take its time from.
  execFileSync('ffmpeg', [
    '-y', '-loglevel', 'error', '-loop', '1', '-i', join(tmp, 'frame.png'), '-ss', '0.9', '-i', video,
    '-filter_complex',
    `[1:v]scale=${inner.width}:${inner.height}:flags=lanczos[v];[0:v][v]overlay=${padding}:${padding + bar}:shortest=1,` +
    'fps=12,mpdecimate,split[a][b];[a]palettegen=max_colors=128:stats_mode=diff[p];' +
    '[b][p]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle',
    '-final_delay', '180', `${DOCS}demo.gif`,
  ])
  rmSync(tmp, { recursive: true })
})
