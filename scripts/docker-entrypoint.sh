#!/bin/sh
set -e

PRISMA_BIN=$(find /app/node_modules -name "index.js" -path "*/prisma/build/*" | head -1)

echo "Running Prisma migrations..."
node "$PRISMA_BIN" migrate deploy

# TIT-38: the migrations create an empty `permissions` table and four EMPTY
# permission templates, then assign every user one of those templates. Until
# this step runs, every template resolves to zero permissions and the
# fail-closed permission guard denies every permissioned route — for admins,
# staff and customers alike. It is not optional test data, it is part of the
# deploy. Idempotent, and it aborts (via `set -e`) rather than letting the
# application start against an incomplete catalog.
echo "Syncing permission catalog and templates..."
node dist/src/shared/authorization/infrastructure/sync-permission-catalog.cli.js

echo "Starting application..."
exec node dist/src/main.js
