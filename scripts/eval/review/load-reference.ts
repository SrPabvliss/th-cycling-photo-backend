/**
 * Loads the reviewer's decisions (review-server.ts -> decisiones.csv) into the
 * evaluation reference tables. Idempotent for the photos in the CSV: their
 * rows in eval.dataset_photos and eval.ground_truth_bibs are replaced; photos
 * not in the CSV are left untouched (not yet reviewed = not in the set).
 *
 *   decision   -> dataset_photos                      -> ground_truth_bibs
 *   ok         included                                 digits_after (or digits_before)
 *   corregido  included                                 digits_after
 *   sin_placa  included                                 (none)
 *   ilegible   included, bib_visible_unreadable         (none)
 *   excluir    included = false, exclusion_reason       (none)
 *
 * Usage: npx tsx scripts/eval/review/load-reference.ts [--csv scripts/eval/review/data/decisiones.csv] [--dry-run]
 */
import { config } from 'dotenv'

config({ path: '.env.development' })

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { Pool } from 'pg'

const { DB_USER, DB_PASSWORD, DB_HOST, DB_PORT, DB_NAME } = process.env
if (DB_HOST !== 'localhost' && DB_HOST !== '127.0.0.1') {
  console.error(`Refusing to run: DB_HOST is '${DB_HOST}', which is not local.`)
  process.exit(1)
}

const argv = process.argv.slice(2)
const get = (name: string): string | undefined => {
  const i = argv.indexOf(`--${name}`)
  return i >= 0 ? argv[i + 1] : undefined
}
const CSV = get('csv') ?? join(__dirname, 'data', 'decisiones.csv')
const DRY = argv.includes('--dry-run')

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

function loadLatest(): Map<string, Decision> {
  const lines = readFileSync(CSV, 'utf8').split('\n').filter(Boolean)
  const keys = lines[0].split(',') as (keyof Decision)[]
  const latest = new Map<string, Decision>()
  for (const line of lines.slice(1)) {
    const f = parseCsvLine(line)
    const row = Object.fromEntries(keys.map((k, i) => [k, f[i] ?? ''])) as Decision
    latest.set(row.photo_id, row) // last line of a photo wins
  }
  return latest
}

async function main() {
  const latest = loadLatest()
  const rows = [...latest.values()]
  const counts = new Map<string, number>()
  for (const r of rows) counts.set(r.decision, (counts.get(r.decision) ?? 0) + 1)
  console.log(`${rows.length} photos decided:`, Object.fromEntries(counts))
  if (DRY) return

  const pool = new Pool({
    host: DB_HOST,
    port: Number(DB_PORT),
    user: DB_USER,
    password: DB_PASSWORD,
    database: DB_NAME,
  })
  const client = await pool.connect()
  try {
    await client.query('begin')
    const ids = rows.map((r) => r.photo_id)
    await client.query('delete from eval.ground_truth_bibs where photo_id = any($1::uuid[])', [ids])
    await client.query('delete from eval.dataset_photos where photo_id = any($1::uuid[])', [ids])
    const now = new Date()
    let bibs = 0
    for (const r of rows) {
      const included = r.decision !== 'excluir'
      await client.query(
        `insert into eval.dataset_photos (photo_id, event_id, included, exclusion_reason, bib_visible_unreadable, frozen_at)
         values ($1, $2, $3, $4, $5, $6)`,
        [
          r.photo_id,
          r.event_id,
          included,
          included ? null : r.reason + (r.note ? `: ${r.note}` : ''),
          r.decision === 'ilegible',
          now,
        ],
      )
      if (r.decision === 'ok' || r.decision === 'corregido') {
        const digits = (r.digits_after || r.digits_before).split(';').filter(Boolean)
        for (const d of new Set(digits)) {
          await client.query(
            `insert into eval.ground_truth_bibs (photo_id, digits, source, frozen_at) values ($1, $2, $3, $4)`,
            [r.photo_id, d, r.decision === 'ok' ? 'production_confirmed' : 'review', now],
          )
          bibs++
        }
      }
    }
    await client.query('commit')
    console.log(`loaded ${rows.length} dataset_photos rows, ${bibs} ground-truth bibs`)
  } catch (err) {
    await client.query('rollback')
    throw err
  } finally {
    client.release()
    await pool.end()
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
