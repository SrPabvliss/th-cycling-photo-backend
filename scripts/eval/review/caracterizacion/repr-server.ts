/**
 * Local app for the author to pick, by eye, the representative photos of every
 * option of every dimension (dimensiones.json). candidatos.csv (candidatos.py)
 * lists the photos shown per option: the ones already labelled with it plus the
 * best ranked by a pixel proxy. The author marks each photo as preseleccionada,
 * final or descartada; decisions are appended to data/repr-decisiones.csv (last
 * line per dimension, option and photo wins). Thumbnails from thumbs.py.
 *
 * Usage: npx tsx scripts/eval/review/caracterizacion/repr-server.ts [--port 5180] [--cache ~/thesis/review-cache]
 * then open http://127.0.0.1:5180
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
const PORT = Number(get('port') ?? 5180)
const CACHE = (get('cache') ?? join(homedir(), 'thesis', 'review-cache')).replace(/^~/, homedir())
const CSV = get('csv') ?? join(__dirname, 'data', 'repr-decisiones.csv')
const PAGE = join(__dirname, 'repr.html')
const TAXONOMY = JSON.parse(readFileSync(join(__dirname, 'dimensiones.json'), 'utf8')) as {
  dimensiones: { id: string; label: string; opciones: [string, string][] }[]
}
const ESTADOS = new Set(['ninguna', 'preseleccionada', 'final', 'descartada'])
const KEYS = [
  'at',
  'dimension',
  'opcion',
  'photo_id',
  'event',
  'filename',
  'estado',
  'note',
] as const
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

const candidatos = readCsv(join(__dirname, 'candidatos.csv'))
const byKey = new Map(candidatos.map((c) => [`${c.dimension}|${c.opcion}|${c.photo_id}`, c]))
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
  if (head.trim() !== HEADER.trim()) throw new Error(`log header differs: ${CSV}`)
  for (const line of lines) {
    const f = parseCsvLine(line)
    const row = Object.fromEntries(KEYS.map((k, i) => [k, f[i] ?? ''])) as Decision
    latest.set(`${row.dimension}|${row.opcion}|${row.photo_id}`, row)
  }
  console.log(`${lines.length} decisions in log, ${latest.size} (option, photo) pairs decided`)
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
  latest.set(`${d.dimension}|${d.opcion}|${d.photo_id}`, d)
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
  if (req.method === 'GET' && url.pathname === '/')
    return send(res, 200, readFileSync(PAGE), 'text/html; charset=utf-8')
  if (req.method === 'GET' && url.pathname === '/api/taxonomy') return send(res, 200, TAXONOMY)
  if (req.method === 'GET' && url.pathname === '/api/candidatos') {
    return send(
      res,
      200,
      candidatos.map((c) => {
        const d = latest.get(`${c.dimension}|${c.opcion}|${c.photo_id}`)
        return { ...c, estado: d?.estado ?? 'ninguna', note: d?.note ?? '' }
      }),
    )
  }
  const img = url.pathname.match(/^\/(img|thumb)\/([0-9a-f-]{36})\/([0-9a-f-]{36})\.jpg$/)
  if (req.method === 'GET' && img) {
    const [, kind, eventId, photoId] = img
    const path =
      kind === 'thumb'
        ? join(CACHE, 'thumbs', `${photoId}.jpg`)
        : join(CACHE, eventId, `${photoId}.jpg`)
    if (!existsSync(path)) return send(res, 404, { error: 'photo' })
    res.writeHead(200, { 'content-type': 'image/jpeg', 'cache-control': 'max-age=86400' })
    return res.end(readFileSync(path))
  }
  if (req.method === 'POST' && url.pathname === '/api/decision') {
    const body = (await readBody(req)) as Record<string, unknown>
    const photoId = String(body.photo_id ?? '')
    const dimension = String(body.dimension ?? '')
    const opcion = String(body.opcion ?? '')
    const estado = String(body.estado ?? '')
    if (!UUID.test(photoId)) return send(res, 400, { error: 'ids' })
    const c = byKey.get(`${dimension}|${opcion}|${photoId}`)
    if (!c) return send(res, 400, { error: 'photo not a candidate of that option' })
    if (!ESTADOS.has(estado)) return send(res, 400, { error: 'estado' })
    const d: Decision = {
      at: new Date().toISOString(),
      dimension,
      opcion,
      photo_id: photoId,
      event: c.event,
      filename: c.filename,
      estado,
      note: String(body.note ?? '').trim(),
    }
    appendDecision(d)
    return send(res, 200, d)
  }
  send(res, 404, { error: 'not found' })
}

loadLog()
console.log(`${candidatos.length} candidate rows`)
createServer((req, res) => {
  handle(req, res).catch((error) => {
    console.error(error)
    send(res, 500, { error: String(error) })
  })
}).listen(PORT, '127.0.0.1', () => {
  console.log(`representantes app on http://127.0.0.1:${PORT}  log ${CSV}  cache ${CACHE}`)
})
