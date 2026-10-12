/**
 * Local app to characterize the test events photo by photo. The sample
 * (muestra.csv) holds, per event, the 10 photos with a legible bib that sit at
 * the extremes of the pixel statistics (seleccionar.py); the assistant proposed
 * a label per dimension (prelabels.csv) and the author accepts or edits it
 * on closed scales (dimensiones.json: light, surroundings,
 * visible weather, camera angle, distance) and may flag it as representative
 * of its event. No database; photos come from the reduced copies of
 * fetch-images.ts.
 *
 * Every decision is appended to data/carac-decisiones.csv (one line per
 * decision, flushed before replying); the last line of a photo wins.
 *
 * Usage:
 *   npx tsx scripts/eval/review/caracterizacion/carac-server.ts [--port 5179] \
 *     [--cache ~/thesis/review-cache] [--sample .../muestra.csv] [--csv .../carac-decisiones.csv]
 * then open http://127.0.0.1:5179
 */
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

const argv = process.argv.slice(2)
const get = (name: string): string | undefined => {
  const i = argv.indexOf(`--${name}`)
  return i >= 0 ? argv[i + 1] : undefined
}
const PORT = Number(get('port') ?? 5179)
const CACHE = (get('cache') ?? join(homedir(), 'thesis', 'review-cache')).replace(/^~/, homedir())
const SAMPLE = get('sample') ?? join(__dirname, 'muestra.csv')
const CSV = get('csv') ?? join(__dirname, 'data', 'carac-decisiones.csv')
const PAGE = join(__dirname, 'carac.html')
const TAXONOMY = JSON.parse(readFileSync(join(__dirname, 'dimensiones.json'), 'utf8')) as {
  dimensiones: { id: string; label: string; opciones: [string, string][] }[]
}
const DIMS = TAXONOMY.dimensiones.map((d) => d.id)

const FIXED = ['at', 'photo_id', 'event_id', 'event', 'filename'] as const
const TAIL = ['representativa', 'note', 'origen'] as const
const KEYS = [...FIXED, ...DIMS, ...TAIL]
const HEADER = `${KEYS.join(',')}\n`
type Decision = Record<string, string>

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

function readCsv(path: string): Record<string, string>[] {
  const [head, ...lines] = readFileSync(path, 'utf8')
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .filter(Boolean)
  const keys = parseCsvLine(head)
  return lines.map((l) => {
    const f = parseCsvLine(l)
    return Object.fromEntries(keys.map((k, i) => [k, f[i] ?? '']))
  })
}

// Detection boxes of the winning pair, as exported: "digits@conf:x1,y1,x2,y2 | ..."
function parseBoxes(s: string) {
  return s
    .split(' | ')
    .map((b) => b.trim())
    .filter((b) => b.includes('@'))
    .map((b) => {
      const [digits, rest] = b.split('@', 2)
      const [conf, coords] = rest.split(':', 2)
      return { digits, confidence: Number(conf), bbox: coords.split(',').map(Number) }
    })
}

// Labels proposed by the assistant (prelabels.csv): the author accepts or edits them.
const PRE = new Map(readCsv(join(__dirname, 'prelabels.csv')).map((r) => [r.photo_id, r]))

const sample = readCsv(SAMPLE).map((r) => ({
  id: r.photo_id,
  event_id: r.event_id,
  event: r.event,
  filename: r.filename,
  unreadable: r.unreadable === 't',
  truth: r.truth,
  boxes: parseBoxes(r.boxes),
  criterio: r.criterio ?? '',
  prelabel: PRE.get(r.photo_id) ?? null,
}))

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
  const [head, ...lines] = readFileSync(CSV, 'utf8').split('\n').filter(Boolean)
  if (head.trim() !== HEADER.trim())
    throw new Error(`log header differs from dimensiones.json: ${CSV}`)
  for (const line of lines) {
    const fields = parseCsvLine(line)
    const row = Object.fromEntries(KEYS.map((k, i) => [k, fields[i] ?? ''])) as Decision
    latest.set(row.photo_id, row)
  }
  console.log(`${lines.length} decisions in log, ${latest.size} photos decided`)
}

function appendDecision(d: Decision) {
  const line = `${KEYS.map((k) => csvField(d[k] ?? '')).join(',')}\n`
  const fd = openSync(CSV, 'a')
  try {
    writeSync(fd, line)
    fsyncSync(fd)
  } finally {
    closeSync(fd)
  }
  latest.set(d.photo_id, d)
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
  if (req.method === 'GET' && url.pathname === '/api/taxonomy') return send(res, 200, TAXONOMY)
  if (req.method === 'GET' && url.pathname === '/api/queue') {
    return send(
      res,
      200,
      sample.map((p) => ({ ...p, decision: latest.get(p.id) ?? null })),
    )
  }
  const img = url.pathname.match(/^\/img\/([0-9a-f-]{36})\/([0-9a-f-]{36})\.jpg$/)
  if (req.method === 'GET' && img) {
    const [, eventId, photoId] = img
    const path = join(CACHE, eventId, `${photoId}.jpg`)
    if (!existsSync(path)) return send(res, 404, { error: 'photo' })
    res.writeHead(200, { 'content-type': 'image/jpeg', 'cache-control': 'max-age=86400' })
    return res.end(readFileSync(path))
  }
  if (req.method === 'POST' && url.pathname === '/api/decision') {
    const body = (await readBody(req)) as Record<string, unknown>
    const photoId = String(body.photo_id ?? '')
    if (!UUID.test(photoId)) return send(res, 400, { error: 'ids' })
    const p = sample.find((s) => s.id === photoId)
    if (!p) return send(res, 400, { error: 'photo not in sample' })
    const d: Decision = {
      at: new Date().toISOString(),
      photo_id: p.id,
      event_id: p.event_id,
      event: p.event,
      filename: p.filename,
      representativa: body.representativa === true ? '1' : '',
      note: String(body.note ?? '').trim(),
      origen: '',
    }
    // Every dimension must carry one of its options.
    for (const dim of TAXONOMY.dimensiones) {
      const v = String(body[dim.id] ?? '')
      if (!dim.opciones.some(([id]) => id === v)) return send(res, 400, { error: dim.id })
      d[dim.id] = v
    }
    // Provenance: accepted as proposed, or edited by the author in at least one dimension.
    const pre = PRE.get(p.id)
    d.origen =
      pre && TAXONOMY.dimensiones.every((dim) => pre[dim.id] === d[dim.id]) ? 'aceptada' : 'editada'
    appendDecision(d)
    return send(res, 200, d)
  }
  send(res, 404, { error: 'not found' })
}

loadLog()
console.log(`${sample.length} photos in sample ${SAMPLE}`)
createServer((req, res) => {
  handle(req, res).catch((error) => {
    console.error(error)
    send(res, 500, { error: String(error) })
  })
}).listen(PORT, '127.0.0.1', () => {
  console.log(`caracterizacion app on http://127.0.0.1:${PORT}  log ${CSV}  cache ${CACHE}`)
})
