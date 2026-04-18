#!/bin/sh
set -e

# Build DATABASE_URL from individual env vars for Prisma CLI
export DATABASE_URL="postgresql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}"

PRISMA_BIN=$(find /app/node_modules -name "index.js" -path "*/prisma/build/*" | head -1)

echo "Running Prisma migrations..."
node "$PRISMA_BIN" migrate deploy

echo "Starting application..."
exec node dist/src/main.js
