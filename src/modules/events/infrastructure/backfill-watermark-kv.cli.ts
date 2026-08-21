import { ConfigService } from '@nestjs/config'
import { PrismaPg } from '@prisma/adapter-pg'
import { config } from 'dotenv'
import { PrismaClient } from '../../../generated/prisma/client'
import { CloudflareKvAdapter } from '../../../shared/cloudflare/infrastructure/cloudflare-kv.adapter'
import { isSafeStorageKey } from '../../../shared/storage/domain/storage-key'

const env = process.env.NODE_ENV || 'development'
config({ path: `.env.${env}`, quiet: true })
config({ path: '.env', quiet: true })

function buildConnectionString(): string {
  const required = ['DB_USER', 'DB_PASSWORD', 'DB_HOST', 'DB_PORT', 'DB_NAME'] as const
  const missing = required.filter((name) => !process.env[name])
  if (missing.length > 0) {
    throw new Error(`Cannot backfill watermark KV: missing ${missing.join(', ')}`)
  }

  const { DB_USER, DB_PASSWORD, DB_HOST, DB_PORT, DB_NAME, DB_SSL_MODE } = process.env
  let url = `postgresql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}`
  if (DB_SSL_MODE) url += `?sslmode=${DB_SSL_MODE}`
  return url
}

function buildKvAdapter(): CloudflareKvAdapter {
  const required = [
    'CLOUDFLARE_ACCOUNT_ID',
    'CLOUDFLARE_KV_NAMESPACE_ID',
    'CLOUDFLARE_API_TOKEN',
  ] as const
  const missing = required.filter((name) => !process.env[name])
  if (missing.length > 0) {
    throw new Error(`Cannot backfill watermark KV: missing ${missing.join(', ')}`)
  }

  const configService = new ConfigService({
    cloudflare: {
      accountId: process.env.CLOUDFLARE_ACCOUNT_ID,
      kvNamespaceId: process.env.CLOUDFLARE_KV_NAMESPACE_ID,
      apiToken: process.env.CLOUDFLARE_API_TOKEN,
    },
  })
  return new CloudflareKvAdapter(configService)
}

function toSafeEntries(
  entries: { key: string; value: string }[],
): { key: string; value: string }[] {
  return entries.filter((entry) => {
    if (isSafeStorageKey(entry.value)) return true
    console.error(`Skipping ${entry.key}: unsafe storage key ${entry.value}`)
    return false
  })
}

async function main(): Promise<void> {
  const adapter = new PrismaPg({ connectionString: buildConnectionString() })
  const prisma = new PrismaClient({ adapter })
  const kv = buildKvAdapter()

  try {
    const events = await prisma.event.findMany({
      where: { snap_watermark_storage_key: { not: null } },
      select: { id: true, snap_watermark_storage_key: true },
    })
    const tenants = await prisma.tenant.findMany({
      where: { watermark_storage_key: { not: null } },
      select: { id: true, watermark_storage_key: true },
    })

    const eventEntries = toSafeEntries(
      events.map((event) => ({
        key: `wm-${event.id}`,
        value: event.snap_watermark_storage_key as string,
      })),
    )
    const tenantEntries = toSafeEntries(
      tenants.map((tenant) => ({
        key: `wm-tenant-${tenant.id}`,
        value: tenant.watermark_storage_key as string,
      })),
    )

    await kv.writeBulk([...eventEntries, ...tenantEntries])
    console.log(
      `Backfilled ${eventEntries.length} event and ${tenantEntries.length} tenant watermark KV entries`,
    )
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
