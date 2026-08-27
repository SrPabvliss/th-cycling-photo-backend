#!/usr/bin/env bash
set -euo pipefail

# Rebuilds the local development database from a production dump: restore,
# migrate, sync the permission catalog, and set every password to a known one
# so any production account can be signed into locally.
#
# Two ways in:
#   DUMP_FILE=path   restore a dump somebody handed you. Needs no server access.
#   (default)        take a fresh dump through an SSH tunnel. Needs the backup
#                    key and the read-only database role.
#
# Configuration lives in .env.ops, which is not tracked. Copy .env.ops.example
# and fill it in. Nothing about the server belongs in this file.
#
# Photos will not load. Development points at the development buckets and the
# restored rows reference production storage keys. That is expected.

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

if [ -f .env.ops ]; then
  set -a
  # shellcheck disable=SC1091
  . ./.env.ops
  set +a
fi

set -a
# shellcheck disable=SC1091
. ./.env.development
set +a

DEV_PASSWORD="${DEV_PASSWORD:-test123}"
BACKUP_DIR="${BACKUP_DIR:-$(cd "$REPO_ROOT/.." && pwd)/cycling-photo-backups}"
DUMP_FILE="${DUMP_FILE:-}"
STAMP="$(date +%Y%m%d-%H%M)"

missing_config() {
  echo "Missing $1. Set it in .env.ops — see .env.ops.example." >&2
  exit 1
}

[ -n "${BREAK_GLASS_EMAIL:-}" ] || missing_config BREAK_GLASS_EMAIL

if [ -z "$DUMP_FILE" ]; then
  [ -n "${PROD_SSH_HOST:-}" ] || missing_config PROD_SSH_HOST
  [ -n "${PROD_DB_NAME:-}" ] || missing_config PROD_DB_NAME
  [ -n "${PROD_DB_USER:-}" ] || missing_config PROD_DB_USER
  [ -n "${PROD_DB_PASSWORD:-}" ] || missing_config PROD_DB_PASSWORD
fi

PROD_REMOTE_PORT="${PROD_REMOTE_PORT:-15432}"
LOCAL_TUNNEL_PORT="${LOCAL_TUNNEL_PORT:-15433}"

: "${DB_HOST:?DB_HOST missing from .env.development}"
: "${DB_PORT:?DB_PORT missing from .env.development}"
: "${DB_USER:?DB_USER missing from .env.development}"
: "${DB_PASSWORD:?DB_PASSWORD missing from .env.development}"
: "${DB_NAME:?DB_NAME missing from .env.development}"

if [ "$DB_HOST" != "localhost" ] && [ "$DB_HOST" != "127.0.0.1" ]; then
  echo "Refusing to run: DB_HOST is '$DB_HOST', which is not local." >&2
  exit 1
fi

case "$DB_NAME" in
  *prod*|*production*)
    echo "Refusing to run: DB_NAME is '$DB_NAME', which looks like production." >&2
    exit 1
    ;;
esac

export PGPASSWORD="$DB_PASSWORD"
PSQL_ADMIN=(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres -v ON_ERROR_STOP=1 -qtA)

echo "Target: $DB_NAME on $DB_HOST:$DB_PORT"
mkdir -p "$BACKUP_DIR"

if [ -n "$DUMP_FILE" ]; then
  [ -f "$DUMP_FILE" ] || { echo "No such dump: $DUMP_FILE" >&2; exit 1; }
  echo "Source: $DUMP_FILE"
else
  echo
  echo "==> Opening the tunnel to production"
  ssh -f -N -o ExitOnForwardFailure=yes \
    -L "127.0.0.1:${LOCAL_TUNNEL_PORT}:127.0.0.1:${PROD_REMOTE_PORT}" "$PROD_SSH_HOST"
  TUNNEL_PID="$(pgrep -f "127.0.0.1:${LOCAL_TUNNEL_PORT}:127.0.0.1:${PROD_REMOTE_PORT} $PROD_SSH_HOST" | head -1)"
  # shellcheck disable=SC2064
  trap "kill ${TUNNEL_PID:-0} 2>/dev/null || true" EXIT
  echo "    127.0.0.1:${LOCAL_TUNNEL_PORT} -> production"

  echo
  echo "==> Dumping production"
  DUMP_FILE="$BACKUP_DIR/${PROD_DB_NAME}-${STAMP}.dump"
  PGPASSWORD="$PROD_DB_PASSWORD" pg_dump -h 127.0.0.1 -p "$LOCAL_TUNNEL_PORT" \
    -U "$PROD_DB_USER" -d "$PROD_DB_NAME" -Fc > "$DUMP_FILE"
  echo "    $(du -h "$DUMP_FILE" | cut -f1) -> $DUMP_FILE"

  kill "${TUNNEL_PID:-0}" 2>/dev/null || true
  trap - EXIT
fi

echo
echo "==> Backing up the current $DB_NAME before replacing it"
DEV_DUMP="$BACKUP_DIR/${DB_NAME}-before-refresh-${STAMP}.dump"
if pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -Fc > "$DEV_DUMP" 2>/dev/null; then
  echo "    $(du -h "$DEV_DUMP" | cut -f1) -> $DEV_DUMP"
else
  rm -f "$DEV_DUMP"
  echo "    database did not exist, nothing to back up"
fi

echo
echo "==> Recreating $DB_NAME"
"${PSQL_ADMIN[@]}" -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$DB_NAME' AND pid <> pg_backend_pid();" > /dev/null
"${PSQL_ADMIN[@]}" -c "DROP DATABASE IF EXISTS \"$DB_NAME\";"
"${PSQL_ADMIN[@]}" -c "CREATE DATABASE \"$DB_NAME\";"

echo
echo "==> Restoring into $DB_NAME"
pg_restore -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" --no-owner --no-privileges "$DUMP_FILE" 2>&1 \
  | grep -v 'transaction_timeout' || true

echo
echo "==> Setting the break-glass account for the TIT-38 migration"
"${PSQL_ADMIN[@]}" -c "ALTER DATABASE \"$DB_NAME\" SET \"tit38.break_glass_email\" = '$BREAK_GLASS_EMAIL';"

echo
echo "==> Applying pending migrations"
pnpm prisma:migrate:deploy

echo
echo "==> Syncing the permission catalog"
node dist/src/shared/authorization/infrastructure/sync-permission-catalog.cli.js

echo
echo "==> Setting every password to '$DEV_PASSWORD'"
HASH="$(node -e "process.stdout.write(require('bcryptjs').hashSync(process.argv[1], 10))" "$DEV_PASSWORD")"
UPDATED="$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 -qtA \
  -c "UPDATE users SET password_hash = '$HASH' RETURNING 1;" | wc -l | tr -d ' ')"
echo "    $UPDATED accounts"

echo
echo "==> Result"
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "
select
  (select count(*) from users) as users,
  (select count(*) from events) as events,
  (select count(*) from photos) as photos,
  (select count(*) from orders) as orders,
  (select count(*) from user_permission_grants) as grants,
  (select count(*) from permissions) as permissions;"

echo "Every account now signs in with '$DEV_PASSWORD'. Photos will not load — the"
echo "rows reference production storage and this environment reads development buckets."
echo
echo "This database now holds real customer names, emails and phone numbers."
echo "Treat it as production data: do not share the dump, and delete it when done."
