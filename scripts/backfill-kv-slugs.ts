/**
 * Backfills Workers KV with slug → storage_key mappings for all existing photos.
 * Run after migration 20260409220000_photo_public_slug.
 *
 * Usage: npx tsx scripts/backfill-kv-slugs.ts
 */

import { config } from 'dotenv'

const env = process.env.NODE_ENV || 'development'
config({ path: `.env.${env}` })
config({ path: '.env' })

const { CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_KV_NAMESPACE_ID, CLOUDFLARE_API_TOKEN } = process.env

if (!CLOUDFLARE_ACCOUNT_ID || !CLOUDFLARE_KV_NAMESPACE_ID || !CLOUDFLARE_API_TOKEN) {
  console.error(
    'Missing CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_KV_NAMESPACE_ID, or CLOUDFLARE_API_TOKEN',
  )
  process.exit(1)
}

import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../src/generated/prisma/client'

const { DB_USER, DB_PASSWORD, DB_HOST, DB_PORT, DB_NAME, DB_SSL_MODE } = process.env
let connectionString = `postgresql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}`
if (DB_SSL_MODE) connectionString += `?sslmode=${DB_SSL_MODE}`

const adapter = new PrismaPg({ connectionString })
const prisma = new PrismaClient({ adapter })

const KV_BASE = `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/storage/kv/namespaces/${CLOUDFLARE_KV_NAMESPACE_ID}`

async function main() {
  const photos = await prisma.photo.findMany({
    select: { id: true, public_slug: true, storage_key: true },
  })

  console.log(`Found ${photos.length} photos to backfill`)

  if (photos.length === 0) {
    console.log('Nothing to do')
    return
  }

  // KV bulk write supports up to 10,000 keys per request
  const BATCH_SIZE = 10_000
  let written = 0

  for (let i = 0; i < photos.length; i += BATCH_SIZE) {
    const batch = photos.slice(i, i + BATCH_SIZE)
    const body = batch.map((p) => ({ key: p.public_slug, value: p.storage_key }))

    const response = await fetch(`${KV_BASE}/bulk`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${CLOUDFLARE_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const text = await response.text()
      console.error(`KV bulk write failed: ${response.status} ${text}`)
      process.exit(1)
    }

    written += batch.length
    console.log(`Written ${written}/${photos.length} KV entries`)
  }

  console.log(`Done. ${written} slug→path mappings registered in KV.`)
}

main()
  .catch((err) => {
    console.error('Backfill error:', err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
