import { execSync } from 'node:child_process'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

// Starts Redmine and the mock GitHub/GitLab API and seeds test data.
// Set E2E_SKIP_STACK=1 to run against an already prepared stack.
export default function globalSetup() {
  if (process.env.E2E_SKIP_STACK) return

  const cwd = dirname(fileURLToPath(import.meta.url))
  execSync('docker compose up -d --wait', { cwd, stdio: 'inherit' })
  execSync('docker compose exec -T redmine bin/rails runner plugins/redmine_pull_requests/e2e/seed.rb', { cwd, stdio: 'inherit' })
}
