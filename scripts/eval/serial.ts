/**
 * Serial driver for the chained evaluation: every photo goes through every
 * detector x reader pair, one request at a time, against ONE evaluation
 * endpoint (scripts/modal_inference_eval.py deployed with EVAL_TIMING=1: one
 * container, every pair loaded and warm). Timings are therefore paired per
 * photo on the same host. Creates one eval.runs row per pair; resumable.
 *
 * Order: photos by the event order given in --events (then filename), the
 * same for every pair. Within a photo the pairs rotate (cyclic Latin square:
 * photo k starts at pair k mod N) so no pair always runs first or last. The
 * same signed URL is sent to every pair, so the service downloads the photo
 * once (EVAL_IMAGE_CACHE).
 *
 * Usage:
 *   npx tsx scripts/eval/serial.ts --endpoint <url> --label "encadenado A" \
 *     --pairs yolo26m_1024:parseq_v2,yolo26m_1024:svtrv2_b,rfdetr_l_896:parseq_v2,rfdetr_l_896:svtrv2_b,yolo:parseq \
 *     --events <uuid>,<uuid> [--resume <run_id>,<run_id>,...] [--every K] [--limit N]
 *     [--det-threshold 0.05] [--ocr-threshold 0] [--max-bibs 10] [--bib-padding 0.12] [--no-crops] [--no-prefetch]
 * --resume takes the run ids in the same order as --pairs; photos with a row in
 * every run are skipped, the others redo only the pairs they lack.
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

type Pair = { detector: string; ocr: string }
type Args = {
  endpoint: string
  label: string
  pairs: Pair[]
  events: string[]
  resume?: number[]
  detThreshold: number
  ocrThreshold: number
  maxBibs: number
  bibPadding?: number
  limit?: number
  every?: number
  saveCrops: boolean
  noPrefetch: boolean
}

function fail(message: string): never {
  console.error(message)
  process.exit(1)
}

function parseArgs(): Args {
  const argv = process.argv.slice(2)
  const get = (name: string): string | undefined => {
    const i = argv.indexOf(`--${name}`)
    return i >= 0 ? argv[i + 1] : undefined
  }
  const endpoint = get('endpoint')
  const label = get('label')
  const pairs = (get('pairs') ?? '')
    .split(',')
    .filter(Boolean)
    .map((p) => {
      const [detector, ocr] = p.split(':')
      if (!detector || !ocr) fail(`Bad pair '${p}', expected detector:ocr`)
      return { detector, ocr }
    })
  const events = (get('events') ?? '').split(',').filter(Boolean)
  if (!endpoint || !label || pairs.length === 0 || events.length === 0) {
    fail('Required: --endpoint <url> --label <text> --pairs det:ocr,... --events <uuid>,...')
  }
  const resume = get('resume')?.split(',').filter(Boolean).map(Number)
  if (resume && resume.length !== pairs.length) fail('--resume needs one run id per pair, in order')
  return {
    endpoint,
    label,
    pairs,
    events,
    resume,
    detThreshold: Number(get('det-threshold') ?? 0.05),
    ocrThreshold: Number(get('ocr-threshold') ?? 0),
    maxBibs: Number(get('max-bibs') ?? 10),
    bibPadding: get('bib-padding') ? Number(get('bib-padding')) : undefined,
    limit: get('limit') ? Number(get('limit')) : undefined,
    every: get('every') ? Number(get('every')) : undefined,
    saveCrops: !argv.includes('--no-crops'),
    noPrefetch: argv.includes('--no-prefetch'),
  }
}

if (DB_HOST !== 'localhost' && DB_HOST !== '127.0.0.1') {
  fail(`Refusing to run: DB_HOST is '${DB_HOST}', which is not local.`)
}
if (!B2_APPLICATION_KEY_ID || !B2_APPLICATION_KEY || !B2_BUCKET_NAME) {
  fail('Missing B2 credentials in .env.development.')
}

const args = parseArgs()

const pool = new Pool({
  host: DB_HOST,
  port: Number(DB_PORT),
  user: DB_USER,
  password: DB_PASSWORD,
  database: DB_NAME,
  max: 3,
})

const s3 = new S3Client({
  region: B2_REGION,
  endpoint: `https://s3.${B2_REGION}.backblazeb2.com`,
  credentials: { accessKeyId: B2_APPLICATION_KEY_ID, secretAccessKey: B2_APPLICATION_KEY },
})

type PhotoRow = { id: string; storage_key: string; seq: number; missing: number[] }

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

async function createOrResumeRuns(): Promise<number[]> {
  if (args.resume) {
    const { rows } = await pool.query<{
      id: number
      detector: string
      ocr: string
      status: string
    }>(
      'select id, detector, ocr, status from eval.runs where id = any($1) order by array_position($1, id)',
      [args.resume],
    )
    if (rows.length !== args.pairs.length) fail('Some --resume run ids do not exist.')
    rows.forEach((r, i) => {
      const p = args.pairs[i]
      if (r.detector !== p.detector || r.ocr !== p.ocr)
        fail(`Run ${r.id} is ${r.detector}+${r.ocr}, not ${p.detector}+${p.ocr}.`)
      if (r.status !== 'running' && r.status !== 'completed') fail(`Run ${r.id} is ${r.status}.`)
    })
    // Rows that failed (network, 5xx) are redone: drop them so the photo counts as pending.
    const dropped = await pool.query(
      'delete from eval.run_photos where run_id = any($1) and status = $2',
      [args.resume, 'error'],
    )
    console.log(
      `Resuming runs ${args.resume.join(', ')} (${dropped.rowCount ?? 0} failed rows dropped)`,
    )
    return args.resume
  }

  const meta = (await fetchJson(`${args.endpoint}/meta`)) as {
    git_commit?: string
    defaults?: { ocr_preprocess?: string }
  }
  const ids: number[] = []
  for (const p of args.pairs) {
    const { rows } = await pool.query<{ id: number }>(
      `insert into eval.runs
         (label, detector, ocr, endpoint, det_threshold, ocr_threshold, max_bibs, ocr_preprocess,
          ai_commit, meta, concurrency, events, notes)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 1, $11, $12)
       returning id`,
      [
        `${args.label} ${p.detector}+${p.ocr}`,
        p.detector,
        p.ocr,
        args.endpoint,
        args.detThreshold,
        args.ocrThreshold,
        args.maxBibs,
        meta.defaults?.ocr_preprocess ?? null,
        meta.git_commit ?? null,
        {
          ...meta,
          serial: true,
          timing: true,
          pairs: args.pairs.map((q) => `${q.detector}+${q.ocr}`),
        },
        args.events,
        [
          'serial, latin square',
          args.bibPadding != null ? `bib_padding=${args.bibPadding}` : null,
          args.every ? `every=${args.every}` : null,
        ]
          .filter(Boolean)
          .join('; '),
      ],
    )
    ids.push(rows[0].id)
  }
  console.log(`Runs ${ids.join(', ')} @ ${args.endpoint} (commit ${meta.git_commit})`)
  return ids
}

// Photos in the fixed order, with the index of every pair still lacking a row.
async function pendingPhotos(runIds: number[]): Promise<PhotoRow[]> {
  const { rows } = await pool.query<{
    id: string
    storage_key: string
    seq: number
    done: number[]
  }>(
    `with ordered as (
       select p.id, p.storage_key,
              row_number() over (order by array_position($1::uuid[], p.event_id), p.filename, p.id) as seq
       from photos p
       where p.event_id = any($1::uuid[])
     )
     select o.id, o.storage_key, o.seq::int,
            coalesce((select array_agg(r.run_id order by r.run_id)
                      from eval.run_photos r where r.run_id = any($2::int[]) and r.photo_id = o.id), '{}') as done
     from ordered o
     where ($3::int is null or o.seq % $3 = 0)
     order by o.seq
     ${args.limit ? `limit ${args.limit}` : ''}`,
    [args.events, runIds, args.every ?? null],
  )
  return rows
    .map((r) => ({
      id: r.id,
      storage_key: r.storage_key,
      seq: r.seq,
      missing: runIds.map((id, i) => (r.done.includes(id) ? -1 : i)).filter((i) => i >= 0),
    }))
    .filter((r) => r.missing.length > 0)
}

async function requestPair(
  runId: number,
  pair: Pair,
  photo: PhotoRow,
  imageUrl: string,
): Promise<'ok' | 'error'> {
  const url =
    `${args.endpoint}/pipeline?detector=${pair.detector}&ocr=${pair.ocr}&color=none` +
    `&ocr_threshold=${args.ocrThreshold}&max_bibs=${args.maxBibs}` +
    (args.bibPadding != null ? `&bib_padding=${args.bibPadding}` : '') +
    (args.saveCrops ? `&crop_dir=run${runId}` : '')

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

async function summary(runIds: number[]): Promise<void> {
  const { rows } = await pool.query(
    `select run_id,
            count(*) filter (where status = 'ok') as ok,
            count(*) filter (where status = 'error') as errors,
            count(distinct container_id) as containers,
            round(percentile_cont(0.5) within group (order by detection_ms) filter (where not cold)::numeric, 1) as det_p50,
            round(percentile_cont(0.5) within group (order by ocr_ms) filter (where not cold)::numeric, 1) as ocr_p50,
            round(percentile_cont(0.5) within group (order by total_ms) filter (where not cold)::numeric, 1) as total_p50
     from eval.run_photos where run_id = any($1) group by run_id order by run_id`,
    [runIds],
  )
  console.table(rows)
}

async function main() {
  const runIds = await createOrResumeRuns()
  const photos = await pendingPhotos(runIds)
  const requests = photos.reduce((a, p) => a + p.missing.length, 0)
  console.log(
    `${photos.length} photos pending (${requests} requests), ${args.pairs.length} pairs, serial`,
  )

  let stopping = false
  process.on('SIGINT', () => {
    console.log(`\nStopping after this photo. Resume with --resume ${runIds.join(',')}`)
    stopping = true
  })

  const signed = (photo: PhotoRow) =>
    getSignedUrl(s3, new GetObjectCommand({ Bucket: B2_BUCKET_NAME, Key: photo.storage_key }), {
      expiresIn: SIGNED_URL_TTL_S,
    })
  // The service downloads photo k+1 (bytes only, no GPU) while photo k goes
  // through the pairs; the same URL is then sent to every pair of k+1.
  const prefetch = (url: string) =>
    fetch(`${args.endpoint}/prefetch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image_url: url }),
    }).catch(() => undefined)

  const started = Date.now()
  let done = 0
  let errors = 0
  let nextUrl: string | undefined = photos.length ? await signed(photos[0]) : undefined
  for (const [k, photo] of photos.entries()) {
    if (stopping) break
    const imageUrl = nextUrl as string
    if (k + 1 < photos.length) {
      nextUrl = await signed(photos[k + 1])
      if (!args.noPrefetch) void prefetch(nextUrl)
    }
    // Rotate the pair order by photo: cyclic Latin square over the pairs.
    const n = args.pairs.length
    const start = photo.seq % n
    const order = Array.from({ length: n }, (_, k) => (start + k) % n).filter((i) =>
      photo.missing.includes(i),
    )
    for (const i of order) {
      try {
        const result = await requestPair(runIds[i], args.pairs[i], photo, imageUrl)
        if (result === 'error') errors++
      } catch (err) {
        errors++
        console.error(`photo ${photo.id} pair ${i}: ${String(err).slice(0, 200)}`)
      }
    }
    done++
    if (done % 25 === 0 || done === photos.length) {
      const elapsed = (Date.now() - started) / 1000
      const perPhoto = elapsed / done
      const eta = ((photos.length - done) * perPhoto) / 60
      console.log(
        `${done}/${photos.length} photos (${errors} errors, ${perPhoto.toFixed(2)} s/photo, ETA ${eta.toFixed(0)} min)`,
      )
    }
  }

  if (!stopping) {
    await pool.query(
      `update eval.runs set status = 'completed', finished_at = now() where id = any($1)`,
      [runIds],
    )
  }
  await summary(runIds)
  console.log(
    stopping ? `Runs ${runIds.join(', ')} paused.` : `Runs ${runIds.join(', ')} completed.`,
  )
}

main()
  .catch((err) => {
    console.error('Run failed:', err)
    process.exitCode = 1
  })
  .finally(() => pool.end())
