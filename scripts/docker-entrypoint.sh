#!/bin/sh
set -e

PRISMA_BIN=$(find /app/node_modules -name "index.js" -path "*/prisma/build/*" | head -1)

echo "Running Prisma migrations..."
node "$PRISMA_BIN" migrate deploy

echo "Starting application..."
exec node dist/src/main.js
