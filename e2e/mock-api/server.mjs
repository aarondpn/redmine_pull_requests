// Minimal stand-in for the GitHub and GitLab APIs used by the E2E tests.
//
// GitHub
//   GET  /repos/:owner/:repo/pulls/:number                -> pull request
//   GET  /repos/:owner/:repo/pulls/:number/reviews        -> reviews
//   GET  /repos/:owner/:repo/commits/:sha/check-runs      -> check runs
//   GET  /repos/:owner/:repo/commits/:sha/status          -> combined commit status
//   POST /graphql                                         -> review threads (needs a token)
// Repository names are case-insensitive like on GitHub/GitLab. A fixture with
// an "error" status (e.g. { "error": 502 }) answers the pull request with it.
// GitLab (all need PRIVATE-TOKEN)
//   GET  /api/v4/projects/:path/merge_requests/:iid[/commits|/reviewers|/approvals|/discussions]
// Test helpers
//   GET  /avatars/:login.svg                              -> generated avatar
//   PUT  /__fixtures/github/:owner/:repo/:number          -> merge JSON into a fixture
//   PUT  /__fixtures/gitlab/:path/:iid                    -> merge JSON into a fixture
//   POST /__reset                                         -> restore initial fixtures
import http from 'node:http'

const PUBLIC_URL = process.env.PUBLIC_URL || 'http://localhost:4010'
const GITHUB_TOKEN = 'e2e-github-token'
const GITLAB_TOKEN = 'e2e-gitlab-token'
const daysAgo = (days) => new Date(Date.now() - days * 86400e3).toISOString()
const githubUser = (login) => ({ login, avatar_url: `${PUBLIC_URL}/avatars/${login}.svg`, html_url: `https://github.com/${login}` })
const gitlabUser = (username) => ({ username, name: username, avatar_url: `${PUBLIC_URL}/avatars/${username}.svg` })
const review = (login, state) => ({ user: githubUser(login), state, submitted_at: daysAgo(1) })
const checkRun = (name, status, conclusion = null) => ({ name, status, conclusion })

// A GitHub fixture is { pr, reviews, checkRuns, statuses, threads }
function githubPr(repo, number, attrs) {
  const {
    ageDays = 3, author = 'octocat', reviews = [], checkRuns = [], statuses = [], threads = [], ...rest
  } = attrs
  const sha = `${repo.replace('/', '-')}-${number}-sha`
  return {
    pr: {
      url: `https://api.github.com/repos/${repo}/pulls/${number}`,
      html_url: `https://github.com/${repo}/pull/${number}`,
      number,
      state: 'open',
      draft: false,
      merged: false,
      user: githubUser(author),
      created_at: daysAgo(ageDays),
      closed_at: null,
      merged_at: null,
      merged_by: null,
      requested_reviewers: [],
      requested_teams: [],
      head: { ref: `feature/${number}`, sha, repo: { full_name: repo } },
      base: { ref: 'main', repo: { full_name: repo } },
      commits: 1,
      additions: 10,
      deletions: 2,
      changed_files: 1,
      comments: 0,
      review_comments: 0,
      ...rest,
    },
    reviews,
    checkRuns,
    statuses,
    threads,
  }
}

// A GitLab fixture is { mr, commits, reviewers, approvals, discussions }
function gitlabMr(project, iid, attrs) {
  const {
    ageDays = 3, author = 'tanuki', commits = 1, reviewers = [], approvedBy = [], approvalsLeft = 0,
    discussions = [], pipeline = null, ...rest
  } = attrs
  return {
    mr: {
      iid,
      web_url: `https://gitlab.com/${project}/-/merge_requests/${iid}`,
      state: 'opened',
      draft: false,
      author: gitlabUser(author),
      merge_user: null,
      created_at: daysAgo(ageDays),
      merged_at: null,
      closed_at: null,
      source_branch: `feature-${iid}`,
      target_branch: 'main',
      changes_count: '1',
      sha: `${project.replaceAll('/', '-')}-${iid}-sha`,
      user_notes_count: 0,
      reviewers: reviewers.map(([username]) => gitlabUser(username)),
      head_pipeline: pipeline && {
        status: pipeline, web_url: `https://gitlab.com/${project}/-/pipelines/${1000 + iid}`,
      },
      references: { full: `${project}!${iid}` },
      ...rest,
    },
    commits,
    reviewers: reviewers.map(([username, state]) => ({ user: gitlabUser(username), state })),
    approvals: { approved_by: approvedBy.map((u) => ({ user: gitlabUser(u) })), approvals_left: approvalsLeft },
    discussions: discussions.map((resolved, i) => ({ id: `d${i}`, notes: [{ resolvable: true, resolved }] })),
  }
}

function initialFixtures() {
  return {
    github: {
      'acme/web/42': githubPr('acme/web', 42, {
        title: 'Add OAuth login with GitHub and Google', head: { ref: 'feature/oauth-login', sha: 'acme-web-42-sha' },
        commits: 7, additions: 1312, deletions: 48, changed_files: 23, ageDays: 2, comments: 5, review_comments: 7,
        requested_reviewers: [githubUser('sidney')],
        reviews: [review('hubot', 'COMMENTED'), review('monalisa', 'APPROVED')],
        checkRuns: [checkRun('build', 'completed', 'success'), checkRun('lint', 'completed', 'success'),
          checkRun('unit', 'completed', 'success'), checkRun('e2e', 'in_progress')],
        threads: [false, true, false],
      }),
      'acme/api/108': githubPr('acme/api', 108, {
        title: 'Rate-limit public API endpoints', author: 'hubot', head: { ref: 'rate-limit', sha: 'acme-api-108-sha' },
        state: 'closed', merged: true, merged_at: daysAgo(1), closed_at: daysAgo(1), merged_by: githubUser('monalisa'),
        commits: 3, additions: 214, deletions: 31, changed_files: 6, ageDays: 5, comments: 3, review_comments: 4,
        reviews: [review('monalisa', 'APPROVED'), review('sidney', 'APPROVED')],
        checkRuns: ['build', 'lint', 'unit', 'e2e', 'security'].map((n) => checkRun(n, 'completed', 'success')),
        statuses: [{ context: 'ci/jenkins', state: 'success' }],
        threads: [true, true],
      }),
      'acme/web/57': githubPr('acme/web', 57, {
        title: 'WIP: Redesign account settings page', author: 'monalisa', draft: true,
        head: { ref: 'settings-redesign', sha: 'acme-web-57-sha' }, commits: 12, additions: 860, deletions: 702,
        changed_files: 31, ageDays: 1, comments: 2,
        checkRuns: [checkRun('build', 'completed', 'success'), checkRun('lint', 'completed', 'failure'),
          checkRun('unit', 'completed', 'skipped')],
      }),
      'acme/web/61': githubPr('acme/web', 61, {
        title: 'Switch session store to Redis', author: 'hubot', head: { ref: 'redis-sessions', sha: 'acme-web-61-sha' },
        state: 'closed', closed_at: daysAgo(2), commits: 2, additions: 40, deletions: 12, changed_files: 3, ageDays: 9,
        comments: 1,
      }),
    },
    gitlab: {
      'acme/platform/web/12': gitlabMr('acme/platform/web', 12, {
        title: 'Migrate CI to GitLab pipelines', source_branch: 'ci-migration', commits: 4, changes_count: '9', ageDays: 2,
        user_notes_count: 4, pipeline: 'running', reviewers: [['sidney', 'requested_changes'], ['hubot', 'unreviewed']],
        approvalsLeft: 1, discussions: [true, false],
      }),
      'acme/platform/web/15': gitlabMr('acme/platform/web', 15, {
        title: 'Cache dependency downloads', author: 'sidney', source_branch: 'cache-deps', state: 'merged',
        merged_at: daysAgo(1), merge_user: gitlabUser('tanuki'), commits: 2, ageDays: 4, user_notes_count: 2,
        pipeline: 'success', reviewers: [['tanuki', 'approved']], approvedBy: ['tanuki'],
      }),
      'acme/platform/web/21': gitlabMr('acme/platform/web', 21, {
        title: 'Add review apps', author: 'sidney', source_branch: 'review-apps', commits: 6, ageDays: 1,
        pipeline: 'failed', approvalsLeft: 1,
      }),
    },
  }
}

let fixtures = initialFixtures()

const COLORS = ['#8250df', '#1f883d', '#bf3989', '#0969da', '#bc4c00', '#6639ba']
function avatar(login) {
  const color = COLORS[[...login].reduce((sum, c) => sum + c.charCodeAt(0), 0) % COLORS.length]
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><rect width="40" height="40" fill="${color}"/>` +
    `<text x="20" y="26" font-family="sans-serif" font-size="18" font-weight="600" fill="#fff" text-anchor="middle">` +
    `${login[0].toUpperCase()}</text></svg>`
}

function send(res, status, body, { type = 'application/json', headers = {} } = {}) {
  res.writeHead(status, { 'Content-Type': type, 'Access-Control-Allow-Origin': '*', ...headers })
  res.end(typeof body === 'string' ? body : JSON.stringify(body))
  return true
}

function readBody(req) {
  return new Promise((resolve) => {
    let data = ''
    req.on('data', (chunk) => (data += chunk))
    req.on('end', () => resolve(data ? JSON.parse(data) : {}))
  })
}

const notFound = (res, message = 'Not Found') => send(res, 404, { message })
const githubBySha = (repo, sha) => Object.entries(fixtures.github)
  .find(([key, f]) => key.startsWith(`${repo}/`) && f.pr.head.sha === sha)?.[1]

function github(req, res, path) {
  let m
  if ((m = path.match(/^\/repos\/([\w.-]+\/[\w.-]+)\/pulls\/(\d+)(\/reviews)?$/))) {
    const fixture = fixtures.github[`${m[1].toLowerCase()}/${m[2]}`]
    if (!fixture) return notFound(res)
    if (fixture.pr.error) return send(res, fixture.pr.error, { message: 'Server Error' })
    return send(res, 200, m[3] ? fixture.reviews : fixture.pr)
  }
  if ((m = path.match(/^\/repos\/([\w.-]+\/[\w.-]+)\/commits\/([\w-]+)\/(check-runs|status)$/))) {
    const fixture = githubBySha(m[1].toLowerCase(), m[2])
    if (!fixture) return notFound(res, 'No commit found for SHA')
    if (m[3] === 'check-runs') return send(res, 200, { total_count: fixture.checkRuns.length, check_runs: fixture.checkRuns })
    return send(res, 200, { state: fixture.statuses.length ? 'success' : 'pending', total_count: fixture.statuses.length, statuses: fixture.statuses })
  }
}

function gitlab(req, res, path) {
  const m = path.match(/^\/api\/v4\/projects\/([^/]+)\/merge_requests\/(\d+)(?:\/(commits|reviewers|approvals|discussions))?$/)
  if (!m) return
  if (req.headers['private-token'] !== GITLAB_TOKEN) return send(res, 401, { message: '401 Unauthorized' })
  const fixture = fixtures.gitlab[`${decodeURIComponent(m[1]).toLowerCase()}/${m[2]}`]
  if (!fixture) return notFound(res, '404 Not found')
  switch (m[3]) {
    case undefined: return send(res, 200, fixture.mr)
    case 'commits': {
      const commits = Array.from({ length: fixture.commits }, (_, i) => ({ id: `c${i}` }))
      return send(res, 200, commits, { headers: { 'X-Total': String(fixture.commits) } })
    }
    default: return send(res, 200, fixture[m[3]])
  }
}

http.createServer(async (req, res) => {
  const url = new URL(req.url, PUBLIC_URL)
  // keep %2F encoded GitLab project paths intact
  const path = req.url.split('?')[0]
  let m

  if (req.method === 'GET' && path.startsWith('/repos/')) return github(req, res, path) ?? notFound(res)
  if (req.method === 'GET' && path.startsWith('/api/v4/')) return gitlab(req, res, path) ?? notFound(res)
  if (req.method === 'POST' && path === '/graphql') {
    if (req.headers.authorization !== `Bearer ${GITHUB_TOKEN}`) return send(res, 401, { message: 'Bad credentials' })
    const { variables: { owner, name, number } } = await readBody(req)
    const fixture = fixtures.github[`${owner}/${name}/${number}`]
    const pullRequest = fixture && { reviewThreads: { nodes: fixture.threads.map((isResolved) => ({ isResolved })) } }
    return send(res, 200, { data: { repository: { pullRequest } } })
  }
  if (req.method === 'GET' && (m = path.match(/^\/avatars\/([\w-]+)\.svg$/))) {
    return send(res, 200, avatar(m[1]), { type: 'image/svg+xml' })
  }
  if (req.method === 'PUT' && (m = url.pathname.match(/^\/__fixtures\/github\/(.+)\/(\d+)$/))) {
    const key = `${m[1]}/${m[2]}`
    const { reviews, checkRuns, statuses, threads, ...attrs } = await readBody(req)
    const fixture = fixtures.github[key] || githubPr(m[1], Number(m[2]), {})
    fixtures.github[key] = {
      pr: { ...fixture.pr, ...attrs },
      reviews: reviews ?? fixture.reviews,
      checkRuns: checkRuns ?? fixture.checkRuns,
      statuses: statuses ?? fixture.statuses,
      threads: threads ?? fixture.threads,
    }
    return send(res, 200, fixtures.github[key].pr)
  }
  if (req.method === 'PUT' && (m = url.pathname.match(/^\/__fixtures\/gitlab\/(.+)\/(\d+)$/))) {
    const key = `${m[1]}/${m[2]}`
    const { commits, reviewers, approvals, discussions, ...attrs } = await readBody(req)
    const fixture = fixtures.gitlab[key] || gitlabMr(m[1], Number(m[2]), {})
    fixtures.gitlab[key] = {
      mr: { ...fixture.mr, ...attrs },
      commits: commits ?? fixture.commits,
      reviewers: reviewers ?? fixture.reviewers,
      approvals: approvals ?? fixture.approvals,
      discussions: discussions ?? fixture.discussions,
    }
    return send(res, 200, fixtures.gitlab[key].mr)
  }
  if (req.method === 'POST' && url.pathname === '/__reset') {
    fixtures = initialFixtures()
    return send(res, 200, { status: 'ok' })
  }
  notFound(res)
}).listen(4010, () => console.log('mock GitHub/GitLab API listening on :4010'))
