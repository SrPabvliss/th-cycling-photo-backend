/**
 * Local app to review the reference labels of the evaluation set, one photo at
 * a time, without the product app and without the CDN. Photos come from the
 * reduced copies of fetch-images.ts (falls back to a signed URL of the dev
 * bucket while a copy is missing). Reads the dev database, never writes to it.
 *
 * Every decision is appended to decisiones.csv (one line per decision, flushed
 * to disk before replying); the last line of a photo wins. Closing the app or
 * the laptop loses at most the photo on screen. Load into eval.dataset_photos
 * and eval.ground_truth_bibs later, once the review is frozen.
 *
 * Usage:
 *   npx tsx scripts/eval/review/review-server.ts [--port 5177] \
 *     [--cache ~/thesis/review-cache] [--csv scripts/eval/review/data/decisiones.csv]
 * then open http://127.0.0.1:5177
 */
import { config } from 'dotenv'

config({ path: '.env.development' })

import {
  closeSync,
  existsSync,
  fsyncSync,
  mkdirSync,
  openSync,
  readFileSync,
  writeSync,
} from 'node:fs'
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
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

const argv = process.argv.slice(2)
const get = (name: string): string | undefined => {
  const i = argv.indexOf(`--${name}`)
  return i >= 0 ? argv[i + 1] : undefined
}
const PORT = Number(get('port') ?? 5177)
const CACHE = (get('cache') ?? join(homedir(), 'thesis', 'review-cache')).replace(/^~/, homedir())
const CSV = get('csv') ?? join(__dirname, 'data', 'decisiones.csv')
const PAGE = join(__dirname, 'review.html')

const DECISIONS = new Set(['ok', 'corregido', 'sin_placa', 'ilegible', 'excluir'])
const HEADER = 'at,photo_id,event_id,filename,decision,digits_before,digits_after,reason,note\n'

const pool = new Pool({
  host: DB_HOST,
  port: Number(DB_PORT),
  user: DB_USER,
  password: DB_PASSWORD,
  database: DB_NAME,
  max: 4,
})

const s3 = new S3Client({
  region: B2_REGION,
  endpoint: `https://s3.${B2_REGION}.backblazeb2.com`,
  credentials: { accessKeyId: B2_APPLICATION_KEY_ID!, secretAccessKey: B2_APPLICATION_KEY! },
})

type Decision = {
  at: string
  photo_id: string
  event_id: string
  filename: string
  decision: string
  digits_before: string
  digits_after: string
  reason: string
  note: string
}

function csvField(value: string): string {
  return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
}

function parseCsvLine(line: string): string[] {
  const out: string[] = []
  let cur = ''
  let quoted = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (quoted) {
      if (c === '"' && line[i + 1] === '"') {
        cur += '"'
        i++
      } else if (c === '"') quoted = false
      else cur += c
    } else if (c === '"') quoted = true
    else if (c === ',') {
      out.push(cur)
      cur = ''
    } else cur += c
  }
  out.push(cur)
  return out
}

// Last decision per photo, rebuilt from the log at start.
const latest = new Map<string, Decision>()

function loadLog() {
  mkdirSync(dirname(CSV), { recursive: true })
  if (!existsSync(CSV)) {
    const fd = openSync(CSV, 'a')
    writeSync(fd, HEADER)
    fsyncSync(fd)
    closeSync(fd)
    return
  }
  const lines = readFileSync(CSV, 'utf8').split('\n').slice(1).filter(Boolean)
  const keys = HEADER.trim().split(',') as (keyof Decision)[]
  for (const line of lines) {
    const fields = parseCsvLine(line)
    const row = Object.fromEntries(keys.map((k, i) => [k, fields[i] ?? ''])) as Decision
    latest.set(row.photo_id, row)
  }
  console.log(`${lines.length} decisions in log, ${latest.size} photos decided`)
}

function appendDecision(d: Decision) {
  const keys = HEADER.trim().split(',') as (keyof Decision)[]
  const line = keys.map((k) => csvField(d[k])).join(',') + '\n'
  const fd = openSync(CSV, 'a')
  try {
    writeSync(fd, line)
    fsyncSync(fd)
  } finally {
    closeSync(fd)
  }
  latest.set(d.photo_id, d)
}

const storageKeys = new Map<string, string>()

async function events() {
  const { rows } = await pool.query<{
    id: string
    name: string
    start_date: string
    photos: number
  }>(
    `select e.id, e.name, e.start_date::text, count(p.id)::int as photos
     from events e join photos p on p.event_id = e.id
     group by e.id order by e.start_date, e.id`,
  )
  const decidedByEvent = new Map<string, number>()
  for (const d of latest.values())
    decidedByEvent.set(d.event_id, (decidedByEvent.get(d.event_id) ?? 0) + 1)
  return rows.map((r) => ({ ...r, decided: decidedByEvent.get(r.id) ?? 0 }))
}

async function queue(eventId: string) {
  const { rows } = await pool.query(
    `select p.id, p.event_id, p.filename, p.storage_key,
            coalesce((select json_agg(json_build_object(
                        'digits', b.digits, 'source', b.source, 'confidence', b.confidence,
                        'status', b.status, 'bbox', b.bbox_source) order by b.created_at)
                      from photo_bibs b where b.photo_id = p.id and b.deleted_at is null), '[]') as bibs,
            coalesce((select json_agg(json_build_object('confidence', d.confidence, 'bbox', d.bbox))
                      from photo_detections d
                      where d.photo_id = p.id and d.class_name = 'competidor_number'), '[]') as plates
     from photos p
     where p.event_id = $1
     order by p.filename, p.id`,
    [eventId],
  )
  return rows.map((r) => {
    storageKeys.set(r.id, r.storage_key)
    const { storage_key: _, ...rest } = r
    return { ...rest, decision: latest.get(r.id) ?? null }
  })
}

async function readBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = []
  for await (const chunk of req) chunks.push(chunk as Buffer)
  return JSON.parse(Buffer.concat(chunks).toString('utf8'))
}

function send(res: ServerResponse, status: number, body: unknown, type = 'application/json') {
  res.writeHead(status, { 'content-type': type, 'cache-control': 'no-store' })
  res.end(type === 'application/json' ? JSON.stringify(body) : (body as Buffer | string))
}

const UUID = /^[0-9a-f-]{36}$/

async function handle(req: IncomingMessage, res: ServerResponse) {
  const url = new URL(req.url ?? '/', 'http://localhost')
  if (req.method === 'GET' && url.pathname === '/') {
    return send(res, 200, readFileSync(PAGE), 'text/html; charset=utf-8')
  }
  if (req.method === 'GET' && url.pathname === '/api/events') return send(res, 200, await events())
  if (req.method === 'GET' && url.pathname === '/api/queue') {
    const eventId = url.searchParams.get('event') ?? ''
    if (!UUID.test(eventId)) return send(res, 400, { error: 'event' })
    return send(res, 200, await queue(eventId))
  }
  const img = url.pathname.match(/^\/img\/([0-9a-f-]{36})\/([0-9a-f-]{36})\.jpg$/)
  if (req.method === 'GET' && img) {
    const [, eventId, photoId] = img
    const path = join(CACHE, eventId, `${photoId}.jpg`)
    if (existsSync(path)) {
      res.writeHead(200, { 'content-type': 'image/jpeg', 'cache-control': 'max-age=86400' })
      return res.end(readFileSync(path))
    }
    const key = storageKeys.get(photoId)
    if (!key) return send(res, 404, { error: 'photo' })
    const signed = await getSignedUrl(
      s3,
      new GetObjectCommand({ Bucket: B2_BUCKET_NAME, Key: key }),
      {
        expiresIn: 3600,
      },
    )
    res.writeHead(302, { location: signed })
    return res.end()
  }
  if (req.method === 'POST' && url.pathname === '/api/decision') {
    const body = (await readBody(req)) as Partial<Decision>
    if (
      !body.photo_id ||
      !UUID.test(body.photo_id) ||
      !body.event_id ||
      !UUID.test(body.event_id)
    ) {
      return send(res, 400, { error: 'ids' })
    }
    if (!body.decision || !DECISIONS.has(body.decision))
      return send(res, 400, { error: 'decision' })
    const digitsAfter = String(body.digits_after ?? '')
    if (digitsAfter && !/^\d+(;\d+)*$/.test(digitsAfter)) return send(res, 400, { error: 'digits' })
    const d: Decision = {
      at: new Date().toISOString(),
      photo_id: body.photo_id,
      event_id: body.event_id,
      filename: String(body.filename ?? ''),
      decision: body.decision,
      digits_before: String(body.digits_before ?? ''),
      digits_after: digitsAfter,
      reason: String(body.reason ?? ''),
      note: String(body.note ?? ''),
    }
    appendDecision(d)
    return send(res, 200, d)
  }
  send(res, 404, { error: 'not found' })
}

loadLog()
createServer((req, res) => {
  handle(req, res).catch((error) => {
    console.error(error)
    send(res, 500, { error: String(error) })
  })
}).listen(PORT, '127.0.0.1', () => {
  console.log(`review app on http://127.0.0.1:${PORT}  log ${CSV}  cache ${CACHE}`)
})
