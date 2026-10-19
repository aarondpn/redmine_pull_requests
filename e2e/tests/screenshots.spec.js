import { test, expect } from '@playwright/test'
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  ADMIN_API_KEY, USERS, linkPullRequests, login, panel, resetMockApi,
} from './helpers.js'

// Captures the images used in the README: npm run screenshots
// Screens are taken at 2x and framed (window mockup on a gradient) in a
// second step, the demo GIF is converted from a recorded video with ffmpeg.
// Each README language gets its own images, SCREENSHOT_LANGUAGES=ja,es
// takes only some of them.

const DOCS = new URL('../../docs/', import.meta.url).pathname

// README language => Redmine locale and the texts of the showcase issues.
// The English images are in docs/, the others in docs/<language>/.
const LANGUAGES = {
  en: {
    locale: 'en',
    subject: 'Users can sign in with GitHub and Google',
    intro: 'Add OAuth login next to the password login.',
    items: ['GitHub and Google as providers', 'Link existing accounts by e-mail',
      'Rate-limit the public API endpoints used by the login flow'],
    single: ['Sign in with GitHub', 'OAuth login with GitHub.'],
  },
  es: {
    locale: 'es',
    subject: 'Los usuarios pueden iniciar sesión con GitHub y Google',
    intro: 'Añadir el inicio de sesión con OAuth junto al inicio de sesión con contraseña.',
    items: ['GitHub y Google como proveedores', 'Vincular las cuentas existentes por correo electrónico',
      'Limitar la frecuencia de los endpoints públicos de la API que usa el inicio de sesión'],
    single: ['Iniciar sesión con GitHub', 'Inicio de sesión con OAuth mediante GitHub.'],
  },
  ja: {
    locale: 'ja',
    subject: 'GitHub と Google でサインインできるようにする',
    intro: 'パスワードによるログインに加えて OAuth ログインを追加する。',
    items: ['プロバイダーは GitHub と Google', '既存のアカウントをメールアドレスで関連付ける',
      'ログインで使う公開 API エンドポイントにレート制限を設ける'],
    single: ['GitHub でサインイン', 'GitHub による OAuth ログイン。'],
  },
  'zh-CN': {
    locale: 'zh',
    subject: '用户可以使用 GitHub 和 Google 登录',
    intro: '在密码登录之外增加 OAuth 登录。',
    items: ['支持 GitHub 和 Google', '通过电子邮件关联已有账户', '对登录流程使用的公共 API 端点进行限流'],
    single: ['使用 GitHub 登录', '通过 GitHub 进行 OAuth 登录。'],
  },
}
const SELECTED = process.env.SCREENSHOT_LANGUAGES?.split(',') ?? Object.keys(LANGUAGES)
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

// UI language of the user the screenshots are taken as
async function setLanguage(request, language) {
  const { users } = await apiGet(request, `/users.json?name=${USERS.dev.login}`)
  const response = await request.put(`/users/${users[0].id}.json`, {
    headers: { 'X-Redmine-API-Key': ADMIN_API_KEY }, data: { user: { language } },
  })
  expect(response.ok()).toBe(true)
}

// the other tests look for English labels
test.afterEach(async ({ request }) => setLanguage(request, ''))

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

for (const language of SELECTED) {
  const texts = LANGUAGES[language]
  if (!texts) throw new Error(`Unknown README language ${language}, one of ${Object.keys(LANGUAGES).join(', ')}`)
  const docs = language === 'en' ? DOCS : `${DOCS}${language}/`
  const description = `${texts.intro}\n\n${texts.items.map((item) => `* ${item}`).join('\n')}`

  test(`issue page and feature screenshots (${language})`, async ({ page, request, browser }) => {
    const tmp = mkdtempSync(join(tmpdir(), 'pr-shots-'))
    mkdirSync(docs, { recursive: true })
    await resetMockApi(request)
    await setLanguage(request, texts.locale)
    await login(page, USERS.dev)

    // Hero: the whole issue page with a compact list and one expanded row
    const issue = await createShowcaseIssue(request, texts.subject, description)
    await page.setViewportSize({ width: 1280, height: 1600 })
    await page.goto(`/issues/${issue.id}`)
    await linkPullRequests(page, [PRS.github57, PRS.gitlab12, PRS.github42, PRS.github108, PRS.github61])
    await expect(panel(page).locator('.pr')).toHaveCount(5)
    // the toggle by class, its label is translated
    await panel(page).locator('.pr', { hasText: '#42' }).locator('.pr-toggle').click()
    await page.mouse.move(0, 0)
    await page.waitForTimeout(300) // chevron animation
    const panelBox = await panel(page).boundingBox()
    await page.screenshot({
      path: join(tmp, 'hero.png'),
      clip: { x: 0, y: 0, width: 1280, height: panelBox.y + panelBox.height + 32 },
    })
    await frame(browser, join(tmp, 'hero.png'), `${docs}hero.png`, { url: `redmine.example.com/issues/${issue.id}` })

    // the separator above the panel would show up as a line at the top of the crops
    await page.addStyleTag({ content: '.pull-requests-hook > hr { visibility: hidden; }' })

    // Compact list with GitHub and GitLab
    await panel(page).locator('.pr', { hasText: '#42' }).locator('.pr-toggle').click()
    await page.mouse.move(0, 0)
    await page.waitForTimeout(300)
    await shoot(page, panel(page), join(tmp, 'compact.png'))
    await frame(browser, join(tmp, 'compact.png'), `${docs}compact.png`, { chrome: false, padding: 40 })

    // All details of a single pull request
    const single = await createShowcaseIssue(request, ...texts.single)
    await page.goto(`/issues/${single.id}`)
    await page.addStyleTag({ content: '.pull-requests-hook > hr { visibility: hidden; }' })
    await linkPullRequests(page, [PRS.github42])
    await page.mouse.move(0, 0)
    await shoot(page, panel(page), join(tmp, 'details.png'))
    await frame(browser, join(tmp, 'details.png'), `${docs}details.png`, { chrome: false, padding: 40 })

    rmSync(tmp, { recursive: true })
  })

  test(`demo GIF (${language})`, async ({ browser, request }) => {
    const tmp = mkdtempSync(join(tmpdir(), 'pr-demo-'))
    mkdirSync(docs, { recursive: true })
    await resetMockApi(request)
    await setLanguage(request, texts.locale)
    const issue = await createShowcaseIssue(request, texts.subject, texts.intro)

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
    // by data attribute and type, the labels are translated
    await panel(page).locator('[data-pr-link-toggle]').click()
    await page.waitForTimeout(400)
    await page.locator('#pull_request_url').pressSequentially(`${PRS.github42} ${PRS.gitlab12}`, { delay: 12 })
    await page.waitForTimeout(400)
    await page.locator('#new-pull-request-form [type="submit"]').click()
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
    await panel(page).locator('[data-pr-view-toggle]').click()
    await page.waitForTimeout(500)
    await page.evaluate(() => window.scrollBy({ top: 200, behavior: 'smooth' }))
    await page.waitForTimeout(2400)
    await panel(page).locator('[data-pr-view-toggle]').click()
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
      '-final_delay', '180', `${docs}demo.gif`,
    ])
    rmSync(tmp, { recursive: true })
  })
}
