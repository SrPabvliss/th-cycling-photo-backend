/**
 * Uploads a watermark PNG to Workers KV under key `_asset:watermark`.
 * The Worker reads it from KV and serves it at /gallery/_assets/watermark.png.
 *
 * Usage:
 *   npx tsx scripts/upload-watermark-to-kv.ts /absolute/path/to/watermark.png
 */

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { config } from 'dotenv'

const env = process.env.NODE_ENV || 'development'
config({ path: `.env.${env}` })
config({ path: '.env' })

const { CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_KV_NAMESPACE_ID, CLOUDFLARE_API_TOKEN } = process.env

if (!CLOUDFLARE_ACCOUNT_ID || !CLOUDFLARE_KV_NAMESPACE_ID || !CLOUDFLARE_API_TOKEN) {
  console.error(
    'Missing CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_KV_NAMESPACE_ID, or CLOUDFLARE_API_TOKEN',
  )
  process.exit(1)
}

const [pathArg] = process.argv.slice(2)
if (!pathArg) {
  console.error('Usage: npx tsx scripts/upload-watermark-to-kv.ts <path-to-png>')
  process.exit(1)
}

const filePath = resolve(pathArg)
const buffer = readFileSync(filePath)

if (buffer.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') {
  console.error(`File at ${filePath} is not a valid PNG`)
  process.exit(1)
}

const url = `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/storage/kv/namespaces/${CLOUDFLARE_KV_NAMESPACE_ID}/values/${encodeURIComponent('_asset:watermark')}`

async function main() {
  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${CLOUDFLARE_API_TOKEN}`,
      'Content-Type': 'application/octet-stream',
    },
    body: buffer,
  })

  if (!response.ok) {
    console.error(`Upload failed: ${response.status} ${await response.text()}`)
    process.exit(1)
  }

  console.log(`Uploaded ${buffer.length} bytes to KV key _asset:watermark`)
}

main().catch((err) => {
  console.error('Upload error:', err)
  process.exit(1)
})
