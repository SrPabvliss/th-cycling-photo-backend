/**
 * Local app to label the cause of every failure of the winning pair
 * (RF-DETR-L@896 + SVTRv2-B) on a stratified sample of the chained evaluation.
 * No database: the sample (muestra.csv) carries the reference, the reading and
 * the detection boxes; photos come from the reduced copies of fetch-images.ts.
 *
 * Taxonomy in motivos.json: a cause (motivo), an optional detail (submotivo),
 * and flags (marcas) that are not causes, such as a wrong reference label.
 * Every decision is appended to data/fallos-decisiones.csv (one line per
 * decision, flushed before replying); the last line of a photo wins.
 *
 * Usage:
 *   npx tsx scripts/eval/review/fallos/fallos-server.ts [--port 5178] \
 *     [--cache ~/thesis/review-cache] [--sample scripts/eval/review/fallos/muestra.csv]
 * then open http://127.0.0.1:5178
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
const PORT = Number(get('port') ?? 5178)
const CACHE = (get('cache') ?? join(homedir(), 'thesis', 'review-cache')).replace(/^~/, homedir())
const SAMPLE = get('sample') ?? join(__dirname, 'muestra.csv')
const CSV = get('csv') ?? join(__dirname, 'data', 'fallos-decisiones.csv')
const PAGE = join(__dirname, 'fallos.html')
const TAXONOMY = JSON.parse(readFileSync(join(__dirname, 'motivos.json'), 'utf8')) as {
  motivos: { id: string; sub: [string, string][]; note?: boolean; fix?: boolean }[]
  marcas: { id: string }[]
}

const HEADER =
  'at,photo_id,event_id,event,filename,tipo,truth,read,motivo,submotivo,marcas,note,truth_fix\n'
type Decision = Record<(typeof KEYS)[number], string>
const KEYS = HEADER.trim().split(',') as [
  'at',
  'photo_id',
  'event_id',
  'event',
  'filename',
  'tipo',
  'truth',
  'read',
  'motivo',
  'submotivo',
  'marcas',
  'note',
  'truth_fix',
]

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

// Detection boxes of the pair, as exported: "digits@conf:x1,y1,x2,y2 | ..."
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

const sample = readCsv(SAMPLE).map((r) => ({
  id: r.photo_id,
  event_id: r.event_id,
  event: r.event,
  filename: r.filename,
  tipo: r.tipo,
  truth: r.truth,
  read: r.read,
  boxes: parseBoxes(r.boxes),
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
  const lines = readFileSync(CSV, 'utf8').split('\n').slice(1).filter(Boolean)
  for (const line of lines) {
    const fields = parseCsvLine(line)
    const row = Object.fromEntries(KEYS.map((k, i) => [k, fields[i] ?? ''])) as Decision
    latest.set(row.photo_id, row)
  }
  console.log(`${lines.length} decisions in log, ${latest.size} photos decided`)
}

function appendDecision(d: Decision) {
  const line = `${KEYS.map((k) => csvField(d[k])).join(',')}\n`
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
    const body = (await readBody(req)) as Partial<Decision>
    if (!body.photo_id || !UUID.test(body.photo_id)) return send(res, 400, { error: 'ids' })
    const p = sample.find((s) => s.id === body.photo_id)
    if (!p) return send(res, 400, { error: 'photo not in sample' })
    const motivo = TAXONOMY.motivos.find((m) => m.id === body.motivo)
    if (!motivo) return send(res, 400, { error: 'motivo' })
    const submotivo = String(body.submotivo ?? '')
    if (motivo.sub.length && !motivo.sub.some(([id]) => id === submotivo))
      return send(res, 400, { error: 'submotivo' })
    if (!motivo.sub.length && submotivo) return send(res, 400, { error: 'submotivo' })
    const note = String(body.note ?? '').trim()
    if (motivo.note && !note) return send(res, 400, { error: 'note' })
    const marcas = String(body.marcas ?? '')
      .split(';')
      .filter(Boolean)
    if (marcas.some((m) => !TAXONOMY.marcas.some((t) => t.id === m)))
      return send(res, 400, { error: 'marcas' })
    // Reference correction: the digits the reviewer now reads (empty = no bib), applied to the
    // reference later; every other motivo leaves it empty.
    const truthFix = String(body.truth_fix ?? '').trim()
    if (motivo.fix && truthFix && !/^\d+(;\d+)*$/.test(truthFix)) return send(res, 400, { error: 'truth_fix' })
    if (!motivo.fix && truthFix) return send(res, 400, { error: 'truth_fix' })
    const d: Decision = {
      at: new Date().toISOString(),
      photo_id: p.id,
      event_id: p.event_id,
      event: p.event,
      filename: p.filename,
      tipo: p.tipo,
      truth: p.truth,
      read: p.read,
      motivo: motivo.id,
      submotivo,
      marcas: marcas.join(';'),
      note,
      truth_fix: truthFix,
    }
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
  console.log(`fallos app on http://127.0.0.1:${PORT}  log ${CSV}  cache ${CACHE}`)
})
