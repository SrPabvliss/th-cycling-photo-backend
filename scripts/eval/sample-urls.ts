/**
 * P-112: stratified sample of evaluation photos with their reference, as
 * signed read URLs, for the service preprocessing ablation
 * (cycling-photo-ai/scripts/eval/modal_p112_service_preprocessing.py).
 *
 * Picks --per-event photos (default 30) at random (seed fixed) among the
 * included photos of every event, writes a JSON list of
 * { photo_id, event, url, truth: string[] } to --out. URLs expire after one
 * hour, so run this right before the Modal script.
 *
 * Usage: npx tsx scripts/eval/sample-urls.ts --per-event 30 --out /tmp/p112-sample.json
 */
import { config } from 'dotenv'

config({ path: '.env.development' })

import { writeFileSync } from 'node:fs'
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
const perEvent = Number(get('per-event') ?? 30)
const out = get('out') ?? '/tmp/p112-sample.json'
const seed = get('seed') ?? 'p112'

if (DB_HOST !== 'localhost' && DB_HOST !== '127.0.0.1') {
  console.error(`Refusing to run: DB_HOST is '${DB_HOST}', which is not local.`)
  process.exit(1)
}
if (!B2_APPLICATION_KEY_ID || !B2_APPLICATION_KEY || !B2_BUCKET_NAME) {
  console.error('Missing B2 credentials in .env.development.')
  process.exit(1)
}

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
  credentials: { accessKeyId: B2_APPLICATION_KEY_ID, secretAccessKey: B2_APPLICATION_KEY },
})

type Row = { photo_id: string; event: string; storage_key: string; truth: string[] }

async function main() {
  // md5(seed || photo_id) gives a deterministic shuffle inside each event.
  const { rows } = await pool.query<Row>(
    `with ranked as (
       select dp.photo_id, e.name as event, p.storage_key,
              coalesce((select array_agg(g.digits order by g.digits) from eval.ground_truth_bibs g where g.photo_id = dp.photo_id), '{}') as truth,
              row_number() over (partition by dp.event_id order by md5($1 || dp.photo_id::text)) as rn
       from eval.dataset_photos dp
       join photos p on p.id = dp.photo_id
       join events e on e.id = dp.event_id
       where dp.included
     )
     select photo_id, event, storage_key, truth from ranked where rn <= $2 order by event, rn`,
    [seed, perEvent],
  )
  const sample = []
  for (const r of rows) {
    const url = await getSignedUrl(
      s3,
      new GetObjectCommand({ Bucket: B2_BUCKET_NAME, Key: r.storage_key }),
      { expiresIn: 3600 },
    )
    sample.push({ photo_id: r.photo_id, event: r.event, url, truth: r.truth })
  }
  writeFileSync(out, JSON.stringify(sample))
  const withBib = sample.filter((s) => s.truth.length > 0).length
  console.log(
    `${sample.length} photos (${withBib} with a reference bib) from ${new Set(sample.map((s) => s.event)).size} events -> ${out}`,
  )
  await pool.end()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
