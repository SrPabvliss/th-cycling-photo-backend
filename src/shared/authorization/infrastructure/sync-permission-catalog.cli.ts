/**
 * Standalone entry point for the permission-catalog synchronisation.
 *
 * Runs from the production image as
 * `node dist/src/shared/authorization/infrastructure/sync-permission-catalog.cli.js`
 * — see `scripts/docker-entrypoint.sh`, which invokes it immediately after
 * `prisma migrate deploy`. It therefore must not depend on anything the
 * runtime stage of the Dockerfile does not ship:
 *
 *  - no `tsx` / `ts-node` (it is compiled into `dist` by `pnpm build`),
 *  - no NestJS bootstrap (no DI container, no `AppModule`),
 *  - no `prisma/` sources beyond what `migrate deploy` already needs,
 *  - only runtime `dependencies` (`dotenv`, `@prisma/adapter-pg`) plus the
 *    generated Prisma client, which `nest build` compiles to
 *    `dist/src/generated/prisma`.
 *
 * Imports are relative for the same reason `sync-permission-catalog.ts`
 * uses relative imports — no reliance on tsconfig path rewriting.
 */
import { PrismaPg } from '@prisma/adapter-pg'
import { config } from 'dotenv'
import { PrismaClient } from '../../../generated/prisma/client'
import { syncPermissionCatalog } from './sync-permission-catalog'

const env = process.env.NODE_ENV || 'development'
// `quiet` keeps dotenv's promotional tips out of the deploy log; in the
// production image neither file exists and the real environment is used.
config({ path: `.env.${env}`, quiet: true })
config({ path: '.env', quiet: true })

/**
 * Same shape `prisma.config.ts` and `PrismaService` build, from the same
 * variables, so this connects to exactly the database `migrate deploy` just
 * migrated. Missing variables throw rather than producing a
 * `postgresql://undefined:undefined@…` URL that fails with a confusing error.
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
