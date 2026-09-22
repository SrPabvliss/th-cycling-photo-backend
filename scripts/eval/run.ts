/**
 * Runs one detector x OCR combination over the photos of the development
 * database against an evaluation endpoint, and stores every reply in the
 * `eval` schema (scripts/eval/schema.sql). Resumable: a run that stopped
 * continues with the photos it has no row for.
 *
 * Photos are sent in a fixed order (event start date, event id, filename), the
 * same for every combination. Each photo is fetched by the service through a
 * signed read URL of the development bucket. Crop upload and color stay off.
 *
 * Usage:
 *   npx tsx scripts/eval/run.ts --detector yolo --ocr parseq --label "piloto 1" \
 *     [--events <uuid>,<uuid>] [--resume <run_id>] [--concurrency 4] \
 *     [--det-threshold 0.05] [--ocr-threshold 0] [--max-bibs 10] [--limit N]
 *     [--bib-padding 0.12] [--endpoint <url>]
 *
 * EVAL_ENDPOINT_<DETECTOR>_<OCR> in .env.ops names each endpoint, e.g.
 *   EVAL_ENDPOINT_YOLO_PARSEQ=https://...--eval-yolo-parseq-api.modal.run
 */
import { config } from 'dotenv'

config({ path: '.env.ops' })
config({ path: '.env.development' })

import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { Pool } from 'pg'

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

const COLD_REQUESTS = 3
const SIGNED_URL_TTL_S = 3600

type Args = {
  detector: string
  ocr: string
  label: string
  events?: string[]
  resume?: number
  concurrency: number
  detThreshold: number
  ocrThreshold: number
  maxBibs: number
  bibPadding?: number
  endpoint?: string
  limit?: number
}

function parseArgs(): Args {
  const argv = process.argv.slice(2)
  const get = (name: string): string | undefined => {
    const i = argv.indexOf(`--${name}`)
    return i >= 0 ? argv[i + 1] : undefined
  }
  const detector = get('detector')
  const ocr = get('ocr')
  const label = get('label')
  if (!detector || !ocr || !label) {
    console.error('Required: --detector <yolo|rfdetr_v3> --ocr <parseq|trocr> --label <text>')
    process.exit(1)
  }
  return {
    detector,
    ocr,
    label,
    events: get('events')?.split(',').filter(Boolean),
    resume: get('resume') ? Number(get('resume')) : undefined,
    concurrency: Number(get('concurrency') ?? 4),
    detThreshold: Number(get('det-threshold') ?? 0.05),
    ocrThreshold: Number(get('ocr-threshold') ?? 0),
    maxBibs: Number(get('max-bibs') ?? 10),
    bibPadding: get('bib-padding') ? Number(get('bib-padding')) : undefined,
    endpoint: get('endpoint'),
    limit: get('limit') ? Number(get('limit')) : undefined,
  }
}

function fail(message: string): never {
  console.error(message)
  process.exit(1)
}

if (DB_HOST !== 'localhost' && DB_HOST !== '127.0.0.1') {
  fail(`Refusing to run: DB_HOST is '${DB_HOST}', which is not local.`)
}
if (!B2_APPLICATION_KEY_ID || !B2_APPLICATION_KEY || !B2_BUCKET_NAME) {
  fail('Missing B2 credentials in .env.development.')
}

const args = parseArgs()
const endpointVar = `EVAL_ENDPOINT_${args.detector.split('_')[0].toUpperCase()}_${args.ocr.toUpperCase()}`
const endpoint = args.endpoint ?? process.env[endpointVar]
if (!endpoint) fail(`Missing ${endpointVar} in .env.ops (or pass --endpoint).`)

const pool = new Pool({
  host: DB_HOST,
  port: Number(DB_PORT),
  user: DB_USER,
  password: DB_PASSWORD,
  database: DB_NAME,
  max: args.concurrency + 2,
})

const s3 = new S3Client({
  region: B2_REGION,
  endpoint: `https://s3.${B2_REGION}.backblazeb2.com`,
  credentials: { accessKeyId: B2_APPLICATION_KEY_ID, secretAccessKey: B2_APPLICATION_KEY },
})

type PhotoRow = { id: string; storage_key: string; seq: number }

async function fetchJson(url: string, init?: RequestInit, attempts = 3): Promise<unknown> {
  let lastError: unknown
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const response = await fetch(url, init)
      if (response.status >= 500 && attempt < attempts) {
        lastError = new Error(`HTTP ${response.status}`)
      } else if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${(await response.text()).slice(0, 300)}`)
      } else {
        return await response.json()
      }
    } catch (err) {
      lastError = err
      if (attempt === attempts) throw err
    }
    await new Promise((r) => setTimeout(r, 2000 * attempt))
  }
  throw lastError
}

async function createOrResumeRun(): Promise<number> {
  if (args.resume) {
    const { rows } = await pool.query(
      'select detector, ocr, endpoint from eval.runs where id = $1 and status = $2',
      [args.resume, 'running'],
    )
    if (rows.length === 0) fail(`Run ${args.resume} does not exist or is not running.`)
    if (rows[0].detector !== args.detector || rows[0].ocr !== args.ocr) {
      fail(
        `Run ${args.resume} is ${rows[0].detector}+${rows[0].ocr}, not ${args.detector}+${args.ocr}.`,
      )
    }
    console.log(`Resuming run ${args.resume}`)
    return args.resume
  }

  const meta = (await fetchJson(`${endpoint}/meta`)) as { git_commit?: string }
  const { rows } = await pool.query(
    `insert into eval.runs
       (label, detector, ocr, endpoint, det_threshold, ocr_threshold, max_bibs, ocr_preprocess,
        ai_commit, meta, concurrency, events, notes)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
     returning id`,
    [
      args.label,
      args.detector,
      args.ocr,
      endpoint,
      args.detThreshold,
      args.ocrThreshold,
      args.maxBibs,
      (meta as { defaults?: { ocr_preprocess?: string } }).defaults?.ocr_preprocess ?? null,
      meta.git_commit ?? null,
      meta,
      args.concurrency,
      args.events ?? null,
      args.bibPadding != null ? `bib_padding=${args.bibPadding}` : null,
    ],
  )
  console.log(
    `Run ${rows[0].id}: ${args.detector}+${args.ocr} @ ${endpoint} (commit ${meta.git_commit})`,
  )
  return rows[0].id
}

async function pendingPhotos(runId: number): Promise<PhotoRow[]> {
  const { rows } = await pool.query<PhotoRow>(
    `with ordered as (
       select p.id, p.storage_key,
              row_number() over (order by e.start_date, e.id, p.filename, p.id) as seq
       from photos p
       join events e on e.id = p.event_id
       where ($1::uuid[] is null or p.event_id = any($1))
     )
     select o.id, o.storage_key, o.seq::int
     from ordered o
     where not exists (select 1 from eval.run_photos r where r.run_id = $2 and r.photo_id = o.id)
     order by o.seq
     ${args.limit ? `limit ${args.limit}` : ''}`,
    [args.events ?? null, runId],
  )
  return rows
}

async function processPhoto(runId: number, photo: PhotoRow): Promise<'ok' | 'error'> {
  const imageUrl = await getSignedUrl(
    s3,
    new GetObjectCommand({ Bucket: B2_BUCKET_NAME, Key: photo.storage_key }),
    { expiresIn: SIGNED_URL_TTL_S },
  )
  const url =
    `${endpoint}/pipeline?detector=${args.detector}&ocr=${args.ocr}&color=none` +
    `&ocr_threshold=${args.ocrThreshold}&max_bibs=${args.maxBibs}` +
    (args.bibPadding != null ? `&bib_padding=${args.bibPadding}` : '')

  const t0 = performance.now()
  let response: any
  try {
    response = await fetchJson(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        image_id: photo.id,
        image_url: imageUrl,
        confidence_threshold: args.detThreshold,
      }),
    })
  } catch (err) {
    await pool.query(
      `insert into eval.run_photos (run_id, photo_id, seq, status, error, http_ms)
       values ($1, $2, $3, 'error', $4, $5)`,
      [runId, photo.id, photo.seq, String(err).slice(0, 1000), performance.now() - t0],
    )
    return 'error'
  }
  const httpMs = performance.now() - t0

  const client = await pool.connect()
  try {
    await client.query('begin')
    const t = response.timings ?? {}
    const rt = response.runtime ?? {}
    await client.query(
      `insert into eval.run_photos
         (run_id, photo_id, seq, status, http_ms, decode_ms, detection_ms, preprocess_ms, ocr_ms,
          total_ms, container_id, request_seq, cold, image_width, image_height, response)
       values ($1, $2, $3, 'ok', $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
      [
        runId,
        photo.id,
        photo.seq,
        httpMs,
        t.decode_ms,
        t.detection_ms,
        t.preprocess_ms,
        t.ocr_ms,
        t.total_ms,
        rt.container_id ?? null,
        rt.request_seq ?? null,
        rt.request_seq != null ? rt.request_seq <= COLD_REQUESTS : null,
        response.image_width,
        response.image_height,
        response,
      ],
    )
    const detections: any[] = response.detections ?? []
    for (const [idx, d] of detections.entries()) {
      await client.query(
        `insert into eval.run_detections (run_id, photo_id, idx, class_name, confidence, bbox)
         values ($1, $2, $3, $4, $5, $6)`,
        [runId, photo.id, idx, d.class_name, d.confidence, d.bbox],
      )
    }
    const bibs: any[] = response.bib_readings ?? []
    for (const [idx, b] of bibs.entries()) {
      await client.query(
        `insert into eval.run_bibs
           (run_id, photo_id, idx, digits, confidence, confidence_uncalibrated, confidence_per_digit,
            status, rejection_reason, raw_ocr_text, bbox_source, bbox_confidence,
            preprocessing_applied, processing_ms, preprocess_ms)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
        [
          runId,
          photo.id,
          idx,
          b.digits ?? '',
          b.confidence,
          b.confidence_uncalibrated,
          b.confidence_per_digit,
          b.status,
          b.rejection_reason,
          b.raw_ocr_text,
          b.bbox_source,
          b.bbox_confidence,
          b.preprocessing_applied,
          b.processing_ms,
          b.preprocess_ms,
        ],
      )
    }
    await client.query('commit')
  } catch (err) {
    await client.query('rollback')
    throw err
  } finally {
    client.release()
  }
  return 'ok'
}

async function summary(runId: number): Promise<void> {
  const { rows } = await pool.query(
    `select count(*) filter (where status = 'ok') as ok,
            count(*) filter (where status = 'error') as errors,
            count(*) filter (where cold) as cold,
            round(percentile_cont(0.5) within group (order by decode_ms) filter (where not cold)::numeric, 1) as decode_p50,
            round(percentile_cont(0.5) within group (order by detection_ms) filter (where not cold)::numeric, 1) as det_p50,
            round(percentile_cont(0.5) within group (order by ocr_ms) filter (where not cold)::numeric, 1) as ocr_p50,
            round(percentile_cont(0.95) within group (order by detection_ms) filter (where not cold)::numeric, 1) as det_p95
     from eval.run_photos where run_id = $1`,
    [runId],
  )
  console.log(rows[0])
}

async function main() {
  const runId = await createOrResumeRun()
  const photos = await pendingPhotos(runId)
  console.log(`${photos.length} photos pending, concurrency ${args.concurrency}`)

  let next = 0
  let done = 0
  let errors = 0
  let stopping = false
  process.on('SIGINT', () => {
    console.log('\nStopping after the requests in flight. Resume with --resume', runId)
    stopping = true
  })

  const started = Date.now()
  async function worker() {
    while (!stopping && next < photos.length) {
      const photo = photos[next++]
      try {
        const result = await processPhoto(runId, photo)
        if (result === 'error') errors++
      } catch (err) {
        errors++
        console.error(`photo ${photo.id}: ${String(err).slice(0, 200)}`)
      }
      done++
      if (done % 25 === 0 || done === photos.length) {
        const rate = done / ((Date.now() - started) / 1000)
        console.log(`${done}/${photos.length} (${errors} errors, ${rate.toFixed(2)} photos/s)`)
      }
    }
  }
  await Promise.all(Array.from({ length: args.concurrency }, worker))

  if (!stopping) {
    await pool.query(
      `update eval.runs set status = 'completed', finished_at = now() where id = $1`,
      [runId],
    )
  }
  await summary(runId)
  console.log(stopping ? `Run ${runId} paused.` : `Run ${runId} completed.`)
}

main()
  .catch((err) => {
    console.error('Run failed:', err)
    process.exitCode = 1
  })
  .finally(() => pool.end())
