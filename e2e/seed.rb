# frozen_string_literal: true

# Prepares a fresh Redmine for the E2E tests:
#   docker compose exec redmine bin/rails runner plugins/redmine_pull_requests/e2e/seed.rb
Redmine::DefaultData::Loader.load('en') if Redmine::DefaultData::Loader.no_data?

ADMIN_API_KEY = 'e2e0000000000000000000000000000000000000'

def api_key(user, value)
  token = Token.find_or_create_by!(user: user, action: 'api')
  token.update_column(:value, value)
end

admin = User.find_by!(login: 'admin')
admin.password = admin.password_confirmation = 'admin12345'
admin.must_change_passwd = false
admin.save!
api_key(admin, ADMIN_API_KEY)

Setting.rest_api_enabled = '1'
Setting.host_name = 'localhost:3000'
Setting.default_language = 'en'
closed = IssueStatus.find_by!(name: 'Resolved')
Setting.commit_update_keywords = [{ 'keywords' => 'fixes,closes,resolves', 'status_id' => closed.id.to_s, 'done_ratio' => '100' }]
Setting.plugin_redmine_pull_requests = Setting.plugin_redmine_pull_requests.merge(
  'github_api_url' => 'http://mock-api:4010',
  'github_token' => 'e2e-github-token',
  'github_webhook_secret' => 'e2e-webhook-secret',
  'gitlab_api_url' => 'http://mock-api:4010/api/v4',
  'gitlab_token' => 'e2e-gitlab-token',
  'gitlab_webhook_secret' => 'e2e-gitlab-secret'
)

Role.find_by!(name: 'Manager').tap { |r| r.add_permission!(:view_pull_requests, :manage_pull_requests, :manage_pull_request_settings) }
Role.find_by!(name: 'Developer').tap { |r| r.add_permission!(:view_pull_requests, :manage_pull_requests) }
Role.find_by!(name: 'Reporter').tap { |r| r.add_permission!(:view_pull_requests) }

def user(login, firstname)
  User.find_by(login: login) || User.new.tap do |u|
    u.login = login
    u.firstname = firstname
    u.lastname = 'Tester'
    u.mail = "#{login}@example.com"
    u.password = u.password_confirmation = 'password123'
    u.save!
  end
end

developer = user('dev', 'Dana')
reporter = user('reporter', 'Remy')
manager = user('manager', 'Mia')

def project(identifier, name, modules)
  Project.find_by(identifier: identifier) || Project.new.tap do |p|
    p.identifier = identifier
    p.name = name
    p.is_public = false
    p.enabled_module_names = modules
    p.trackers = Tracker.all
    p.save!
  end
end

acme = project('acme', 'Acme Web', %w(issue_tracking pull_requests))
legacy = project('legacy', 'Legacy (module disabled)', %w(issue_tracking))
secret = project('secret', 'Secret (no members)', %w(issue_tracking pull_requests))
# the module is enabled, but no repository is allowed
unconfigured = project('unconfigured', 'Unconfigured', %w(issue_tracking pull_requests))
api_key(developer, 'e2e1000000000000000000000000000000000000')
api_key(reporter, 'e2e2000000000000000000000000000000000000')
api_key(manager, 'e2e3000000000000000000000000000000000000')

# Repositories whose pull requests may be linked (Project settings » Pull requests)
{
  acme => "# the repositories used by the tests\ngithub:acme/web\ngithub:acme/api\ngitlab:acme/platform/**",
  # would allow acme/web, but the module is disabled
  legacy => 'acme/web',
  secret => 'github:acme/secret',
  unconfigured => ''
}.each do |p, repositories|
  PullRequestProjectSetting.for(p).update!(repositories: repositories)
end

[acme, legacy, unconfigured].each do |p|
  { developer => 'Developer', reporter => 'Reporter', manager => 'Manager' }.each do |u, role|
    next if Member.exists?(project: p, user: u)

    Member.create!(project: p, principal: u, roles: [Role.find_by!(name: role)])
  end
end

puts 'seeded'
