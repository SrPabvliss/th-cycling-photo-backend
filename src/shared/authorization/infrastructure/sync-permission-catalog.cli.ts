/**
 * Standalone entry point for the permission-catalog sync, run from the production image as
 * `node dist/…/sync-permission-catalog.cli.js` right after `prisma migrate deploy` (see
 * `scripts/docker-entrypoint.sh`).
 *
 * So it must not depend on anything the Dockerfile's runtime stage omits: no `tsx`, no NestJS
 * bootstrap, no tsconfig path rewriting, and only runtime `dependencies` plus the generated client.
 */
import { PrismaPg } from '@prisma/adapter-pg'
import { config } from 'dotenv'
import { PrismaClient } from '../../../generated/prisma/client'
import { syncPermissionCatalog } from './sync-permission-catalog'

const env = process.env.NODE_ENV || 'development'
// `quiet` keeps dotenv's tips out of the deploy log; in production neither file exists anyway.
config({ path: `.env.${env}`, quiet: true })
config({ path: '.env', quiet: true })

/**
 * Built from the same variables as `prisma.config.ts`, so this hits the database `migrate deploy`
 * just migrated. Missing variables throw rather than yielding a `postgresql://undefined@…` URL.
 */
function buildConnectionString(): string {
  const required = ['DB_USER', 'DB_PASSWORD', 'DB_HOST', 'DB_PORT', 'DB_NAME'] as const
  const missing = required.filter((name) => !process.env[name])
  if (missing.length > 0) {
    throw new Error(`Cannot sync the permission catalog: missing ${missing.join(', ')}`)
  }

  const { DB_USER, DB_PASSWORD, DB_HOST, DB_PORT, DB_NAME, DB_SSL_MODE } = process.env
  let url = `postgresql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}`
  if (DB_SSL_MODE) url += `?sslmode=${DB_SSL_MODE}`
  return url
}

async function main(): Promise<void> {
  const adapter = new PrismaPg({ connectionString: buildConnectionString() })
  const prisma = new PrismaClient({ adapter })

  console.log(`Syncing permission catalog | Database: ${process.env.DB_NAME}`)
  try {
    await syncPermissionCatalog(prisma)
    console.log('Permission catalog sync completed.')
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((error) => {
  console.error('Permission catalog sync failed:', error)
  process.exit(1)
})
