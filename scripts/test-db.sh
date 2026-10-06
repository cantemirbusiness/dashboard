#!/usr/bin/env bash
# Runs the database integration test against a throwaway local Postgres +
# PostgREST. Requires `initdb`/`pg_ctl`/`psql` (PostgreSQL 15+) and `postgrest`
# on PATH (or POSTGREST_BIN). Never touches your Supabase project.
set -euo pipefail

PG_BIN="${PG_BIN:-$(dirname "$(command -v pg_ctl || echo /usr/lib/postgresql/16/bin/pg_ctl)")}"
POSTGREST_BIN="${POSTGREST_BIN:-postgrest}"
WORK="$(mktemp -d)"
PORT="${PGPORT_TEST:-54329}"
API_PORT="${API_PORT_TEST:-54330}"
SECRET="test-secret-test-secret-test-secret-123"
USER_A="11111111-1111-4111-8111-111111111111"
USER_B="22222222-2222-4222-8222-222222222222"

# Postgres refuses to run as root; drop to the postgres user if needed (CI containers).
AS_PG=()
if [[ "$(id -u)" == "0" ]]; then
  AS_PG=(runuser -u postgres --)
  chmod 777 "$WORK"
fi

cleanup() {
  [[ -n "${PGRST_PID:-}" ]] && kill "$PGRST_PID" 2>/dev/null || true
  "${AS_PG[@]}" "$PG_BIN/pg_ctl" -D "$WORK/data" -m fast stop >/dev/null 2>&1 || true
  rm -rf "$WORK"
}
trap cleanup EXIT

"${AS_PG[@]}" "$PG_BIN/initdb" -D "$WORK/data" -A trust -U postgres >/dev/null
"${AS_PG[@]}" "$PG_BIN/pg_ctl" -D "$WORK/data" -o "-p $PORT -k $WORK -c listen_addresses=''" -l "$WORK/pg.log" start >/dev/null
PSQL=("$PG_BIN/psql" -h "$WORK" -p "$PORT" -U postgres -v ON_ERROR_STOP=1 -q)

"${PSQL[@]}" -f supabase/tests/supabase_stub.sql
for f in supabase/migrations/*.sql; do "${PSQL[@]}" -f "$f"; done
"${PSQL[@]}" -c "insert into auth.users (id, email) values ('$USER_A', 'a@test.local'), ('$USER_B', 'b@test.local');"

PGRST_DB_URI="postgres://authenticator:authenticator@/postgres?host=$WORK&port=$PORT" \
PGRST_DB_SCHEMAS=public PGRST_DB_ANON_ROLE=anon PGRST_JWT_SECRET="$SECRET" \
PGRST_SERVER_PORT="$API_PORT" PGRST_SERVER_HOST=127.0.0.1 \
  "$POSTGREST_BIN" > "$WORK/pgrst.log" 2>&1 &
PGRST_PID=$!
for _ in $(seq 1 50); do curl -sf "http://127.0.0.1:$API_PORT/" >/dev/null && break; sleep 0.2; done

DB_TEST_URL="http://127.0.0.1:$API_PORT" DB_TEST_JWT_SECRET="$SECRET" DB_TEST_USER_A="$USER_A" DB_TEST_USER_B="$USER_B" \
  npx vitest run src/lib/data/db.integration.test.ts
