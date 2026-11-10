import { writeFileSync } from 'node:fs'
import { parseArgs } from 'node:util'
import { config } from 'dotenv'

const env = process.env.NODE_ENV || 'development'
config({ path: `.env.${env}` })
config({ path: '.env' })

import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../src/generated/prisma/client'
import type { YupanaOutboxEntry } from '../src/shared/yupana/domain/ports'
import {
  type BackfillPhoto,
  type BackfillPlan,
  type BackfillProcessing,
  YupanaBackfill,
} from '../src/shared/yupana/domain/yupana-backfill'

const USAGE =
  'usage: pnpm yupana:backfill --from 2026-06-01 --to 2026-11-01 --bucket cycling-photo-prod --cold-start-ms <n> [--dry-run] [--out plan.json]'
const BATCH_SIZE = 500
const IDLE_SECONDS = 300

interface PhotoRow {
  id: string
  event_id: string
  file_size: bigint
  retouched_file_size: bigint | null
  uploaded_at: Date
  retouched_at: Date | null
}

interface ProcessingRow {
  id: string
  photo_id: string
  event_id: string
  status: BackfillProcessing['status']
  started_at: Date
  completed_at: Date | null
}

interface ItemResult {
  outcome: 'accepted' | 'duplicate' | 'rejected'
  reason: string | null
  sourceReportId?: string
  photoId?: string
}

const { values } = parseArgs({
  options: {
    from: { type: 'string' },
    to: { type: 'string' },
    bucket: { type: 'string' },
    'cold-start-ms': { type: 'string' },
    'dry-run': { type: 'boolean', default: false },
    out: { type: 'string' },
  },
})

const coldStartMs = Number(values['cold-start-ms'])
if (
  !values.from ||
  !values.to ||
  !values.bucket ||
  !Number.isInteger(coldStartMs) ||
  coldStartMs < 0
) {
  console.error(USAGE)
  process.exit(1)
}

const from = new Date(`${values.from}T00:00:00.000Z`)
const to = new Date(`${values.to}T00:00:00.000Z`)
const bucket = values.bucket
const dryRun = values['dry-run'] === true
const { YUPANA_BASE_URL, YUPANA_BACKFILL_KEY } = process.env

if (!dryRun && (!YUPANA_BASE_URL || !YUPANA_BACKFILL_KEY)) {
  console.error('YUPANA_BASE_URL and YUPANA_BACKFILL_KEY must be set to send')
  process.exit(1)
}

const { DB_USER, DB_PASSWORD, DB_HOST, DB_PORT, DB_NAME, DB_SSL_MODE } = process.env
let connectionString = `postgresql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}`
if (DB_SSL_MODE) connectionString += `?sslmode=${DB_SSL_MODE}`
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) })

async function readPhotos(): Promise<BackfillPhoto[]> {
  const rows = await prisma.$queryRaw<PhotoRow[]>`
    SELECT id, event_id, file_size, retouched_file_size,
           uploaded_at, retouched_at
    FROM photos
    WHERE uploaded_at < ${to}
    ORDER BY uploaded_at, id`
  return rows.map((row) => ({
    id: row.id,
    eventId: row.event_id,
    fileSize: BigInt(row.file_size),
    retouchedFileSize: row.retouched_file_size === null ? null : BigInt(row.retouched_file_size),
    uploadedAt: row.uploaded_at,
    retouchedAt: row.retouched_at,
  }))
}

async function readProcessings(): Promise<BackfillProcessing[]> {
  const rows = await prisma.$queryRaw<ProcessingRow[]>`
    SELECT processing.id, processing.photo_id, photo.event_id, processing.status::text AS status, processing.started_at, processing.completed_at
    FROM photo_processings processing
    INNER JOIN photos photo ON photo.id = processing.photo_id
    WHERE processing.started_at >= ${from} AND processing.started_at < ${to}
    ORDER BY processing.started_at, processing.id`
  return rows.map((row) => ({
    id: row.id,
    photoId: row.photo_id,
    eventId: row.event_id,
    status: row.status,
    startedAt: row.started_at,
    completedAt: row.completed_at,
  }))
}

function kindOf(itemKey: string): string {
  return itemKey.startsWith(`${YupanaBackfill.REPORT_PREFIX}:`)
    ? itemKey.split(':')[1]
    : 'declaration'
}

function countsOf(plan: BackfillPlan): Record<string, number> {
  const counts: Record<string, number> = { declaration: plan.declarations.length }
  for (const entry of plan.reports) {
    const kind = kindOf(entry.itemKey)
    counts[kind] = (counts[kind] ?? 0) + 1
  }
  return counts
}

async function post(path: string, body: Record<string, unknown>): Promise<ItemResult[]> {
  const response = await fetch(`${YUPANA_BASE_URL?.replace(/\/$/, '')}${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${YUPANA_BACKFILL_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const text = await response.text()
  if (!response.ok) {
    throw new Error(`POST ${path} answered ${response.status}: ${text.slice(0, 500)}`)
  }
  return (JSON.parse(text) as { data: ItemResult[] }).data
}

async function send(
  path: string,
  field: 'declarations' | 'reports',
  entries: YupanaOutboxEntry[],
  tally: Record<string, Record<string, number>>,
  rejections: string[],
): Promise<void> {
  for (let start = 0; start < entries.length; start += BATCH_SIZE) {
    const batch = entries.slice(start, start + BATCH_SIZE)
    const results = await post(path, { [field]: batch.map((entry) => entry.payload) })
    if (results.length !== batch.length) {
      throw new Error(`POST ${path} answered ${results.length} results for ${batch.length} items`)
    }

    results.forEach((result, index) => {
      const kind = kindOf(batch[index]?.itemKey ?? '')
      tally[kind] = tally[kind] ?? { accepted: 0, duplicate: 0, rejected: 0 }
      tally[kind][result.outcome] += 1
      if (result.outcome === 'rejected') {
        rejections.push(`${batch[index]?.itemKey}: ${result.reason}`)
      }
    })
    process.stdout.write(
      `\r${field} ${Math.min(start + BATCH_SIZE, entries.length)}/${entries.length}`,
    )
  }
  process.stdout.write('\n')
}

async function main(): Promise<number> {
  const photos = await readPhotos()
  const processings = await readProcessings()
  const plan = YupanaBackfill.plan({
    photos,
    processings,
    bucket,
    from,
    to,
    coldStartMs,
    idleSeconds: IDLE_SECONDS,
  })

  console.log(
    JSON.stringify(
      {
        from: from.toISOString(),
        to: to.toISOString(),
        bucket,
        coldStartMs,
        oldestStoredPhoto: photos[0]?.uploadedAt.toISOString() ?? null,
        planned: countsOf(plan),
      },
      null,
      2,
    ),
  )

  if (values.out) {
    writeFileSync(
      values.out,
      JSON.stringify({
        declarations: plan.declarations.map((entry) => entry.payload),
        reports: plan.reports.map((entry) => entry.payload),
      }),
    )
  }
  if (dryRun) return 0

  const tally: Record<string, Record<string, number>> = {}
  const rejections: string[] = []
  await send('/photos/declarations', 'declarations', plan.declarations, tally, rejections)
  await send('/reports', 'reports', plan.reports, tally, rejections)

  console.log(JSON.stringify({ sent: tally }, null, 2))
  for (const rejection of rejections) console.error(`rejected ${rejection}`)
  return rejections.length === 0 ? 0 : 1
}

main()
  .then((code) => {
    process.exitCode = code
  })
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
