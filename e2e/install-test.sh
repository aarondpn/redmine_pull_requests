#!/usr/bin/env bash
# Installs the plugin from a release archive into a fresh Redmine container,
# following the Installation and Uninstalling steps of the README, and checks
# that Redmine boots, the plugin is registered and its stylesheet and
# javascript are served on an issue page. The plugin is copied into the
# container (no bind mount), so the files keep the commit time that
# `git archive` stamps on them, just like a downloaded release.
#
#   e2e/install-test.sh 7.0              # any redmine image tag
#   PORT=3270 e2e/install-test.sh 7.0.2
#
# Environment:
#   PORT       host port for Redmine (default 3300, bound to 127.0.0.1)
#   CONTAINER  container name (default rpr-install-<tag without dots>)
#   ARCHIVE    test this .tar.gz instead of building one from HEAD
#   KEEP=1     keep the container afterwards
set -euo pipefail

version=${1:?usage: $0 <redmine image tag>}
port=${PORT:-3300}
container=${CONTAINER:-rpr-install-${version//./}}
url="http://127.0.0.1:${port}"
password=install-test-12345
root=$(cd "$(dirname "$0")/.." && pwd)
tmp=$(mktemp -d)

log() { printf '\n==> %s\n' "$*"; }
fail() { echo "::error::Redmine ${version}: $*" >&2; exit 1; }

cleanup() {
  status=$?
  if [ "$status" -ne 0 ] && docker inspect "$container" >/dev/null 2>&1; then
    echo "--- container log (tail) ---"
    docker logs --tail 150 "$container" 2>&1 || true
  fi
  if [ -z "${KEEP:-}" ]; then docker rm -f -v "$container" >/dev/null 2>&1 || true; fi
  rm -rf "$tmp"
  exit "$status"
}
trap cleanup EXIT

# Commands run as the redmine user in Redmine's directory, like an admin would
redmine() { docker exec -u redmine -w /usr/src/redmine "$container" "$@"; }
# without RAILS_LOG_TO_STDOUT (set by the image) only the script's output is printed
runner() {
  docker exec -u redmine -w /usr/src/redmine -e RAILS_LOG_TO_STDOUT= "$container" \
    bundle exec rails runner -e production "$1"
}

wait_for_redmine() {
  for _ in $(seq 1 120); do
    if curl -fsS -o /dev/null "${url}/login" 2>/dev/null; then return 0; fi
    if [ "$(docker inspect -f '{{.State.Running}}' "$container")" != true ]; then fail "container stopped"; fi
    sleep 2
  done
  fail "Redmine did not come up on ${url}"
}

restart_redmine() {
  docker restart "$container" >/dev/null
  wait_for_redmine
}

# Fetches a page with the admin session, prints the body
get() { curl -fsS -b "$tmp/cookies" -c "$tmp/cookies" "${url}$1"; }

if [ -n "${ARCHIVE:-}" ]; then
  archive=$(cd "$(dirname "$ARCHIVE")" && pwd)/$(basename "$ARCHIVE")
else
  log "Building the release archive from HEAD"
  archive="$tmp/redmine_pull_requests.tar.gz"
  # same command as in .github/workflows/release.yml
  git -C "$root" archive --format=tar.gz --prefix=redmine_pull_requests/ -o "$archive" HEAD
fi

log "Starting a fresh redmine:${version} as ${container} on ${url}"
docker rm -f -v "$container" >/dev/null 2>&1 || true
docker run -d --name "$container" -p "127.0.0.1:${port}:3000" "redmine:${version}" >/dev/null
wait_for_redmine
major=$(redmine sed -n 's/^ *MAJOR *= *\([0-9]*\).*/\1/p' lib/redmine/version.rb)
echo "Redmine major version ${major}"
runner 'puts ActiveRecord::Base.connection.tables.sort' > "$tmp/tables-before"

# README: Installation
log "Installing the plugin"
docker cp "$archive" "${container}:/tmp/redmine_pull_requests.tar.gz"
redmine tar xzf /tmp/redmine_pull_requests.tar.gz -C plugins
redmine bundle exec rake redmine:plugins:migrate RAILS_ENV=production
if [ "$major" -ge 6 ]; then
  redmine bundle exec rake assets:precompile RAILS_ENV=production
fi
restart_redmine

log "Creating a project with the module enabled and an issue"
issue=$(runner "
  plugin = Redmine::Plugin.find(:redmine_pull_requests)
  Redmine::DefaultData::Loader.load('en') if Redmine::DefaultData::Loader.no_data?
  admin = User.find_by!(login: 'admin')
  admin.password = admin.password_confirmation = '${password}'
  admin.must_change_passwd = false
  admin.save!
  # as if the plugin had been configured, so the settings row exists
  Setting.plugin_redmine_pull_requests = Setting.plugin_redmine_pull_requests.merge('link_bare_refs' => '0')
  project = Project.create!(name: 'Install test', identifier: 'install-test',
                            enabled_module_names: %w[issue_tracking pull_requests], trackers: Tracker.all)
  issue = Issue.create!(project: project, tracker: project.trackers.first, author: admin, subject: 'Install test')
  STDERR.puts \"registered: #{plugin.name} #{plugin.version}\"
  puts issue.id
" | tail -n 1)

log "Checking the issue page"
token=$(get /login | sed -n 's/.*name="authenticity_token" value="\([^"]*\)".*/\1/p' | head -n 1)
status=$(curl -sS -o /dev/null -w '%{http_code}' -b "$tmp/cookies" -c "$tmp/cookies" \
  --data-urlencode "authenticity_token=${token}" --data-urlencode username=admin \
  --data-urlencode "password=${password}" "${url}/login")
[ "$status" = 302 ] || fail "login returned HTTP ${status}"

get "/issues/${issue}" > "$tmp/issue.html"
grep -q 'id="pull-requests"' "$tmp/issue.html" || fail "the pull requests panel is missing on /issues/${issue}"
assets=$(grep -o '"[^"]*plugin_assets/redmine_pull_requests/[^"]*"' "$tmp/issue.html" | tr -d '"' | sort -u)
for type in css js; do
  echo "$assets" | grep -q "pull_requests[^/]*\.${type}" || fail "no ${type} of the plugin is linked on the issue page"
done
for asset in $assets; do
  result=$(curl -sS -o /dev/null -w '%{http_code} %{content_type}' "${url}${asset}")
  echo "${asset}: ${result}"
  case "$result" in
    "200 text/css"* | "200 text/javascript"* | "200 application/javascript"*) ;;
    *) fail "${asset} returned ${result}" ;;
  esac
done

# README: Uninstalling
log "Uninstalling the plugin"
redmine bundle exec rake redmine:plugins:migrate NAME=redmine_pull_requests VERSION=0 RAILS_ENV=production
redmine rm -r plugins/redmine_pull_requests
restart_redmine
get "/issues/${issue}" > /dev/null || fail "the issue page fails after uninstalling"

runner 'puts ActiveRecord::Base.connection.tables.sort' > "$tmp/tables-after"
diff -u "$tmp/tables-before" "$tmp/tables-after" || fail "tables are left behind after uninstalling"
runner "
  versions = ActiveRecord::Base.connection.select_values('SELECT version FROM schema_migrations')
  left = versions.grep(/-redmine_pull_requests\\z/)
  abort \"schema_migrations still lists #{left.join(', ')}\" if left.any?
"

# Documented as left behind in the README, together with the commands below
leftovers() {
  runner "puts \"#{EnabledModule.where(name: 'pull_requests').count} enabled_modules row(s), \" \\
               \"#{Setting.where(name: 'plugin_redmine_pull_requests').count} settings row(s)\""
  redmine sh -c 'ls -d public/plugin_assets/redmine_pull_requests public/assets/plugin_assets/redmine_pull_requests 2>/dev/null || :'
}
echo "Left behind:"
leftovers | sed 's/^/  /'

log "Removing what is left (README: Uninstalling)"
runner "EnabledModule.where(name: 'pull_requests').delete_all; Setting.where(name: 'plugin_redmine_pull_requests').delete_all"
redmine rm -rf public/plugin_assets/redmine_pull_requests public/assets/plugin_assets/redmine_pull_requests
[ "$(leftovers)" = "0 enabled_modules row(s), 0 settings row(s)" ] || fail "cleanup left: $(leftovers)"
restart_redmine
get "/issues/${issue}" > /dev/null || fail "the issue page fails after the cleanup"

log "Redmine ${version}: install from archive and uninstall OK"
