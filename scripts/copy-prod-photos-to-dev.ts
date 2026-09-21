/**
 * Copies the photo and event asset (cover) objects the development database
 * references from the production bucket into the development bucket, so a
 * database restored with refresh-dev-from-prod.sh can render its photos.
 *
 * The copy is server-side (S3 CopyObject inside the same B2 account): nothing
 * is downloaded. Production is only read. Objects already present in the
 * development bucket are skipped, so the script is safe to re-run.
 *
 * Needs an application key that can read the production bucket and write the
 * development one, set in .env.ops as B2_COPY_KEY_ID / B2_COPY_KEY, plus
 * PROD_B2_BUCKET_NAME. The B2 master key does not work with the S3 API.
 *
 * Usage:
 *   npx tsx scripts/copy-prod-photos-to-dev.ts [--dry-run] [--with-crops]
 *                                              [--events=<id>,<id>]
 */
import { config } from 'dotenv'

config({ path: '.env.ops' })
config({ path: '.env.development' })

import { CopyObjectCommand, ListObjectsV2Command, S3Client } from '@aws-sdk/client-s3'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../src/generated/prisma/client'

const {
  B2_COPY_KEY_ID,
  B2_COPY_KEY,
  PROD_B2_BUCKET_NAME,
  B2_BUCKET_NAME: DEV_BUCKET,
  B2_REGION = 'us-east-005',
  DB_USER,
  DB_PASSWORD,
  DB_HOST,
  DB_PORT,
  DB_NAME,
} = process.env

const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')
const withCrops = args.includes('--with-crops')
const eventIds = args
  .find((a) => a.startsWith('--events='))
  ?.slice('--events='.length)
  .split(',')
  .filter(Boolean)

const CONCURRENCY = 16

function fail(message: string): never {
  console.error(message)
  process.exit(1)
}

if (!B2_COPY_KEY_ID || !B2_COPY_KEY || !PROD_B2_BUCKET_NAME) {
  fail('Missing B2_COPY_KEY_ID, B2_COPY_KEY or PROD_B2_BUCKET_NAME. Set them in .env.ops.')
}
if (!DEV_BUCKET) fail('Missing B2_BUCKET_NAME in .env.development.')
if (DEV_BUCKET.includes('prod') || DEV_BUCKET === PROD_B2_BUCKET_NAME) {
  fail(`Refusing to write into "${DEV_BUCKET}" — looks like production.`)
}
if (DB_HOST !== 'localhost' && DB_HOST !== '127.0.0.1') {
  fail(`Refusing to run: DB_HOST is '${DB_HOST}', which is not local.`)
}

const s3 = new S3Client({
  region: B2_REGION,
  endpoint: `https://s3.${B2_REGION}.backblazeb2.com`,
  credentials: { accessKeyId: B2_COPY_KEY_ID, secretAccessKey: B2_COPY_KEY },
})

const adapter = new PrismaPg({
  connectionString: `postgresql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}`,
})
const prisma = new PrismaClient({ adapter })

async function listExisting(bucket: string, prefix: string): Promise<Set<string>> {
  const keys = new Set<string>()
  let continuationToken: string | undefined
  do {
    const listed = await s3.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: prefix,
        ContinuationToken: continuationToken,
        MaxKeys: 1000,
      }),
    )
    for (const o of listed.Contents ?? []) if (o.Key) keys.add(o.Key)
    continuationToken = listed.IsTruncated ? listed.NextContinuationToken : undefined
  } while (continuationToken)
  return keys
}

async function collectKeys(eventId: string): Promise<string[]> {
  const photos = await prisma.photo.findMany({
    where: { event_id: eventId },
    select: { storage_key: true, retouched_storage_key: true },
  })
  const keys = photos.flatMap((p) =>
    p.retouched_storage_key ? [p.storage_key, p.retouched_storage_key] : [p.storage_key],
  )

  const assets = await prisma.eventAsset.findMany({
    where: { event_id: eventId },
    select: { storage_key: true },
  })
  for (const asset of assets) keys.push(asset.storage_key)

  if (withCrops) {
    const where = { photo: { event_id: eventId }, crop_path: { not: null } }
    const bibs = await prisma.photoBib.findMany({ where, select: { crop_path: true } })
    const colors = await prisma.photoColor.findMany({ where, select: { crop_path: true } })
    for (const row of [...bibs, ...colors]) if (row.crop_path) keys.push(row.crop_path)
  }

  return [...new Set(keys)]
}

async function copyAll(keys: string[]): Promise<{ copied: number; failed: string[] }> {
  let copied = 0
  let next = 0
  const failed: string[] = []

  async function worker() {
    while (next < keys.length) {
      const key = keys[next++]
      try {
        await s3.send(
          new CopyObjectCommand({
            Bucket: DEV_BUCKET,
            Key: key,
            CopySource: `${PROD_B2_BUCKET_NAME}/${encodeURIComponent(key).replace(/%2F/g, '/')}`,
          }),
        )
        copied += 1
      } catch (err) {
        failed.push(`${key}: ${(err as Error).message}`)
      }
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, worker))
  return { copied, failed }
}

async function main() {
  const events = await prisma.event.findMany({
    where: eventIds ? { id: { in: eventIds } } : undefined,
    select: { id: true, name: true },
    orderBy: { start_date: 'asc' },
  })

  console.log(`${PROD_B2_BUCKET_NAME} -> ${DEV_BUCKET}${dryRun ? ' (dry run)' : ''}`)

  let totalCopied = 0
  const allFailed: string[] = []

  for (const event of events) {
    const wanted = await collectKeys(event.id)
    if (wanted.length === 0) continue

    const existing = await listExisting(DEV_BUCKET as string, `events/${event.id}/`)
    const missing = wanted.filter((k) => !existing.has(k))
    console.log(`${event.name}: ${wanted.length} objects, ${missing.length} to copy`)

    if (dryRun || missing.length === 0) continue

    const { copied, failed } = await copyAll(missing)
    totalCopied += copied
    allFailed.push(...failed)
    console.log(`    copied ${copied}, failed ${failed.length}`)
  }

  console.log(`Done. Copied ${totalCopied} objects.`)
  if (allFailed.length > 0) {
    console.error(`${allFailed.length} objects failed:`)
    for (const line of allFailed.slice(0, 20)) console.error(`  ${line}`)
    process.exitCode = 1
  }
}

main()
  .catch((err) => {
    console.error('Copy failed:', err)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
