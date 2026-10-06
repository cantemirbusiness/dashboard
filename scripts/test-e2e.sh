#!/usr/bin/env bash
# End-to-end auth + app test against a throwaway local stack that mirrors
# Supabase: Postgres, the real Supabase Auth server (GoTrue), PostgREST, a
# gateway on :54321 and an SMTP sink that captures emails. Builds the app,
# starts it, and drives it with a headless browser through sign-up,
# cross-device email confirmation, password reset, demo data and every page.
#
# Requires PostgreSQL 15+ binaries, `postgrest` (or POSTGREST_BIN), Node and a
# Chrome/Chromium (CHROME_PATH). GoTrue is downloaded unless AUTH_BIN is set.
# Never touches your Supabase project.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PG_BIN="${PG_BIN:-$(dirname "$(command -v pg_ctl || echo /usr/lib/postgresql/16/bin/pg_ctl)")}"
POSTGREST_BIN="${POSTGREST_BIN:-postgrest}"
AUTH_VERSION="v2.197.0"
WORK="$(mktemp -d)"
PG_PORT=54339
JWT_SECRET="local-e2e-jwt-secret-at-least-32-characters-long"
APP_URL="http://localhost:3300"
API_URL="http://localhost:54321"

if [[ -z "${CHROME_PATH:-}" ]]; then
  for c in google-chrome chromium chromium-browser /opt/pw-browsers/chromium-*/chrome-linux/chrome; do
    if command -v "$c" >/dev/null 2>&1; then CHROME_PATH="$(command -v "$c")"; break; fi
  done
fi
[[ -n "${CHROME_PATH:-}" ]] || { echo "Set CHROME_PATH to a Chrome/Chromium executable" >&2; exit 1; }
export CHROME_PATH

AS_PG=()
if [[ "$(id -u)" == "0" ]]; then
  AS_PG=(runuser -u postgres --)
  chmod 777 "$WORK"
fi

PIDS=()
cleanup() {
  for pid in "${PIDS[@]}"; do kill "$pid" 2>/dev/null || true; done
  "${AS_PG[@]}" "$PG_BIN/pg_ctl" -D "$WORK/data" -m fast stop >/dev/null 2>&1 || true
  if [[ "${KEEP_E2E_LOGS:-}" == "" ]]; then rm -rf "$WORK"; else echo "Logs kept in $WORK"; fi
}
trap cleanup EXIT
wait_for() { for _ in $(seq 1 100); do curl -sf -o /dev/null "$1" && return 0; sleep 0.3; done; echo "Timed out waiting for $1" >&2; return 1; }

echo "› Postgres"
"${AS_PG[@]}" "$PG_BIN/initdb" -D "$WORK/data" -A trust -U postgres >/dev/null
"${AS_PG[@]}" "$PG_BIN/pg_ctl" -D "$WORK/data" -o "-p $PG_PORT -k $WORK -c listen_addresses=127.0.0.1" -l "$WORK/pg.log" start >/dev/null
PSQL=("$PG_BIN/psql" -h "$WORK" -p "$PG_PORT" -U postgres -d postgres -v ON_ERROR_STOP=1 -q)
"${PSQL[@]}" -f "$ROOT/scripts/e2e/roles.sql"

echo "› Supabase Auth $AUTH_VERSION"
AUTH_DIR="$WORK/auth"
mkdir -p "$AUTH_DIR"
if [[ -n "${AUTH_BIN:-}" ]]; then
  cp -r "$(dirname "$AUTH_BIN")/migrations" "$AUTH_DIR/"
  cp "$AUTH_BIN" "$AUTH_DIR/auth"
else
  curl -fsSL "https://github.com/supabase/auth/releases/download/$AUTH_VERSION/auth-$AUTH_VERSION-x86.tar.gz" | tar xz -C "$AUTH_DIR"
fi
export GOTRUE_API_HOST=127.0.0.1 PORT=9999 API_EXTERNAL_URL="$API_URL/auth/v1"
export GOTRUE_DB_DRIVER=postgres DATABASE_URL="postgres://supabase_auth_admin:authadmin@127.0.0.1:$PG_PORT/postgres?sslmode=disable&search_path=auth"
export GOTRUE_SITE_URL="$APP_URL" GOTRUE_URI_ALLOW_LIST="$APP_URL/auth/confirm"
export GOTRUE_JWT_SECRET="$JWT_SECRET" GOTRUE_JWT_EXP=3600 GOTRUE_JWT_AUD=authenticated GOTRUE_JWT_DEFAULT_GROUP_NAME=authenticated GOTRUE_JWT_ADMIN_ROLES=service_role
export GOTRUE_DISABLE_SIGNUP=false GOTRUE_EXTERNAL_EMAIL_ENABLED=true GOTRUE_MAILER_AUTOCONFIRM=false GOTRUE_PASSWORD_MIN_LENGTH=8
export GOTRUE_SMTP_HOST=127.0.0.1 GOTRUE_SMTP_PORT=2525 GOTRUE_SMTP_USER=x GOTRUE_SMTP_PASS=x GOTRUE_SMTP_ADMIN_EMAIL=noreply@local.test GOTRUE_SMTP_MAX_FREQUENCY=1s
export GOTRUE_MAILER_URLPATHS_CONFIRMATION=/auth/v1/verify GOTRUE_MAILER_URLPATHS_RECOVERY=/auth/v1/verify GOTRUE_MAILER_URLPATHS_INVITE=/auth/v1/verify GOTRUE_MAILER_URLPATHS_EMAIL_CHANGE=/auth/v1/verify
export GOTRUE_RATE_LIMIT_EMAIL_SENT=1000 GOTRUE_LOG_LEVEL=warn
(cd "$AUTH_DIR" && ./auth migrate > "$WORK/auth-migrate.log" 2>&1)

echo "› App migrations"
"${PSQL[@]}" -c "grant execute on all functions in schema auth to anon, authenticated;"
for f in "$ROOT"/supabase/migrations/*.sql; do "${PSQL[@]}" -f "$f"; done

echo "› Services"
node "$ROOT/scripts/e2e/smtp.cjs" "$WORK/mail.jsonl" > "$WORK/smtp.log" 2>&1 & PIDS+=($!)
node "$ROOT/scripts/e2e/gateway.cjs" > "$WORK/gateway.log" 2>&1 & PIDS+=($!)
(cd "$AUTH_DIR" && exec ./auth serve) > "$WORK/auth.log" 2>&1 & PIDS+=($!)
PGRST_DB_URI="postgres://authenticator:authenticator@127.0.0.1:$PG_PORT/postgres" PGRST_DB_SCHEMAS=public PGRST_DB_ANON_ROLE=anon \
PGRST_JWT_SECRET="$JWT_SECRET" PGRST_SERVER_PORT=3001 PGRST_SERVER_HOST=127.0.0.1 \
  "$POSTGREST_BIN" > "$WORK/postgrest.log" 2>&1 & PIDS+=($!)
wait_for "$API_URL/auth/v1/health"
wait_for "http://127.0.0.1:3001/"

ANON_KEY="$(JWT_SECRET="$JWT_SECRET" node -e '
const c = require("crypto"); const b = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const h = b({ alg: "HS256", typ: "JWT" }), p = b({ role: "anon", iss: "supabase", iat: 1700000000, exp: 2100000000 });
process.stdout.write(`${h}.${p}.${c.createHmac("sha256", process.env.JWT_SECRET).update(`${h}.${p}`).digest("base64url")}`);')"

echo "› Build and start the app"
export NEXT_PUBLIC_SUPABASE_URL="$API_URL" NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY="$ANON_KEY" NEXT_PUBLIC_SITE_URL="$APP_URL"
(cd "$ROOT" && npx next build > "$WORK/build.log" 2>&1) || { tail -40 "$WORK/build.log"; exit 1; }
(cd "$ROOT" && exec ./node_modules/.bin/next start -p 3300) > "$WORK/app.log" 2>&1 & PIDS+=($!)
wait_for "$APP_URL/login"

echo "› Browser journey"
E2E_MAIL="$WORK/mail.jsonl" E2E_BASE="$APP_URL" node "$ROOT/scripts/e2e/auth.e2e.cjs"
