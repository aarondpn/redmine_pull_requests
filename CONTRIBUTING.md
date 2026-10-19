# Contributing

## Development

The E2E tests start Redmine and a mock GitHub/GitLab API with Docker and run with [Playwright](https://playwright.dev):

```sh
cd e2e
npm install
npx playwright install chromium
npm test                            # starts Redmine 7.0, seeds it and runs all tests
REDMINE_IMAGE=redmine:5.1 npm test  # any other Redmine image
npm run screenshots                 # regenerates the images in docs/
npm run stack:down                  # removes the containers
./install-test.sh 6.1               # installs a release archive of HEAD into a fresh redmine:6.1
```

Set `E2E_SKIP_STACK=1` to reuse a running, already seeded stack.

Redmine runs at http://localhost:3000 during the tests (log in with `admin` / `admin12345`, `manager`, `dev` or `reporter` with `password123`). To use other ports, set `REDMINE_PORT` and `MOCK_API_PORT` together with `REDMINE_URL` and `MOCK_API_URL`.

## Releasing

1. Update `version` in `init.rb` and add a section for it to `CHANGELOG.md`.
2. Commit, then tag and push: `git tag v1.2.3 && git push origin v1.2.3`.

The release workflow runs the E2E tests on the tagged commit, checks that the tag matches `init.rb`, builds the archives and publishes a GitHub release with the changelog section as notes. Tags with a suffix like `v1.3.0-rc.1` are published as pre-releases and don't become the latest release.
