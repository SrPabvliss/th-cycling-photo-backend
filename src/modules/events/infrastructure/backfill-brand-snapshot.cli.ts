import { PrismaPg } from '@prisma/adapter-pg'
import { config } from 'dotenv'
import { PrismaClient } from '../../../generated/prisma/client'

const env = process.env.NODE_ENV || 'development'
config({ path: `.env.${env}`, quiet: true })
config({ path: '.env', quiet: true })

function buildConnectionString(): string {
  const required = ['DB_USER', 'DB_PASSWORD', 'DB_HOST', 'DB_PORT', 'DB_NAME'] as const
  const missing = required.filter((name) => !process.env[name])
  if (missing.length > 0) {
    throw new Error(`Cannot backfill brand snapshot: missing ${missing.join(', ')}`)
  }

  const { DB_USER, DB_PASSWORD, DB_HOST, DB_PORT, DB_NAME, DB_SSL_MODE } = process.env
  let url = `postgresql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}`
  if (DB_SSL_MODE) url += `?sslmode=${DB_SSL_MODE}`
  return url
}

async function main(): Promise<void> {
  const adapter = new PrismaPg({ connectionString: buildConnectionString() })
  const prisma = new PrismaClient({ adapter })

  try {
    const updated = await prisma.$executeRaw`
      UPDATE events e
      SET snap_public_name = COALESCE(t.public_name, t.name)
      FROM tenants t
      WHERE e.tenant_id = t.id
        AND e.snap_public_name IS NULL
    `
    console.log(`Backfilled snap_public_name on ${updated} event(s).`)
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
