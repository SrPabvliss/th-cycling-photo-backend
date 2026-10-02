/**
 * Downloads every photo of the development database once from the dev bucket
 * and keeps a reduced JPEG copy on disk for the reference review app
 * (review-server.ts). Resumable: photos already on disk are skipped.
 *
 * Copies go to <out>/<event_id>/<photo_id>.jpg, long side --max-side px,
 * EXIF orientation applied. Originals are not kept (40 GB).
 *
 * Usage:
 *   npx tsx scripts/eval/review/fetch-images.ts [--out ~/thesis/review-cache] \
 *     [--events <uuid>,<uuid>] [--limit N] [--concurrency 6] [--max-side 2400]
 */
import { config } from 'dotenv'

config({ path: '.env.development' })

import { mkdir, rename, stat, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { Pool } from 'pg'
import sharp from 'sharp'

const {
  B2_APPLICATION_KEY_ID,
  B2_APPLICATION_KEY,
  B2_BUCKET_NAME,
  B2_REGION = 'us-east-005',
  DB_USER,
  DB_PASSWORD,
  DB_HOST,
  DB_PORT,
  DB_NAME,
} = process.env

const argv = process.argv.slice(2)
const get = (name: string): string | undefined => {
  const i = argv.indexOf(`--${name}`)
  return i >= 0 ? argv[i + 1] : undefined
}
const OUT = (get('out') ?? join(homedir(), 'thesis', 'review-cache')).replace(/^~/, homedir())
const EVENTS = get('events')?.split(',').filter(Boolean) ?? null
const LIMIT = get('limit') ? Number(get('limit')) : null
const CONCURRENCY = Number(get('concurrency') ?? 6)
const MAX_SIDE = Number(get('max-side') ?? 2400)

const pool = new Pool({
  host: DB_HOST,
  port: Number(DB_PORT),
  user: DB_USER,
  password: DB_PASSWORD,
  database: DB_NAME,
})

const s3 = new S3Client({
  region: B2_REGION,
  endpoint: `https://s3.${B2_REGION}.backblazeb2.com`,
  credentials: { accessKeyId: B2_APPLICATION_KEY_ID!, secretAccessKey: B2_APPLICATION_KEY! },
})

type Row = { id: string; event_id: string; storage_key: string }

async function exists(path: string): Promise<boolean> {
  try {
    await stat(path)
    return true
  } catch {
    return false
  }
}

async function fetchOne(row: Row, attempts = 3): Promise<number> {
  const dir = join(OUT, row.event_id)
  const target = join(dir, `${row.id}.jpg`)
  if (await exists(target)) return 0
  await mkdir(dir, { recursive: true })
  let lastError: unknown
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const obj = await s3.send(
        new GetObjectCommand({ Bucket: B2_BUCKET_NAME, Key: row.storage_key }),
      )
      const original = Buffer.from(await obj.Body!.transformToByteArray())
      const reduced = await sharp(original)
        .rotate()
        .resize({ width: MAX_SIDE, height: MAX_SIDE, fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 85 })
        .toBuffer()
      // Write to a temp name first so an interrupted run never leaves a half file.
      await writeFile(`${target}.part`, reduced)
      await rename(`${target}.part`, target)
      return original.length
    } catch (error) {
      lastError = error
      await new Promise((r) => setTimeout(r, 1000 * attempt))
    }
  }
  throw lastError
}

async function main() {
  const { rows } = await pool.query<Row>(
    `select p.id, p.event_id, p.storage_key
     from photos p join events e on e.id = p.event_id
     where ($1::uuid[] is null or p.event_id = any($1))
     order by e.start_date, e.id, p.filename, p.id
     ${LIMIT ? `limit ${LIMIT}` : ''}`,
    [EVENTS],
  )
  console.log(`${rows.length} photos, out ${OUT}`)
  let next = 0
  let done = 0
  let failed = 0
  let bytes = 0
  const started = Date.now()
  const worker = async () => {
    while (next < rows.length) {
      const row = rows[next++]
      try {
        // Await first: `bytes += await ...` reads bytes before the await and loses concurrent updates.
        const fetched = await fetchOne(row)
        bytes += fetched
      } catch (error) {
        failed++
        console.error(`FAIL ${row.id} ${row.storage_key}: ${(error as Error).message}`)
      }
      done++
      if (done % 100 === 0 || done === rows.length) {
        const min = (Date.now() - started) / 60000
        console.log(
          `${done}/${rows.length} failed ${failed} downloaded ${(bytes / 1e9).toFixed(2)} GB ${min.toFixed(1)} min`,
        )
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker))
  await pool.end()
  if (failed) process.exit(1)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
