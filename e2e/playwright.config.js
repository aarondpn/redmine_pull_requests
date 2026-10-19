import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests',
  // the README screenshots are only taken with `npm run screenshots`
  testIgnore: process.env.SCREENSHOTS ? [] : ['**/screenshots.spec.js'],
  globalSetup: './global-setup.js',
  // a forgotten test.only must not silently shrink the suite on CI
  forbidOnly: !!process.env.CI,
  // No retries: the tests run against a local stack and a mock API, so a
  // failure is a real failure (or a flaky test that should be fixed).
  retries: 0,
  // Tests share the mock GitHub fixtures, so run them one after another
  workers: 1,
  timeout: 30_000,
  expect: { timeout: 7_000 },
  // `github` adds failure annotations to the workflow run and pull request
  reporter: process.env.CI
    ? [['github'], ['list'], ['html', { open: 'never' }]]
    : [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: process.env.REDMINE_URL || 'http://localhost:3000',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 900 } } }],
})
