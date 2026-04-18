/**
 * Downloads the watermark PNG from B2 to /tmp/watermark.png.
 * Then run: npx tsx scripts/upload-watermark-to-kv.ts /tmp/watermark.png
 */
import { config } from 'dotenv'

const env = process.env.NODE_ENV || 'development'
config({ path: `.env.${env}` })
config({ path: '.env' })

import { writeFileSync } from 'node:fs'
import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3'

const { B2_APPLICATION_KEY_ID, B2_APPLICATION_KEY, B2_REGION = 'us-east-005' } = process.env

const s3 = new S3Client({
  region: B2_REGION,
  endpoint: `https://s3.${B2_REGION}.backblazeb2.com`,
  credentials: {
    accessKeyId: B2_APPLICATION_KEY_ID!,
    secretAccessKey: B2_APPLICATION_KEY!,
  },
})

async function main() {
  const resp = await s3.send(
    new GetObjectCommand({
      Bucket: 'cycling-photo-dev',
      Key: 'assets/assets_sample_watermark.png',
    }),
  )

  const chunks: Uint8Array[] = []
  for await (const chunk of resp.Body as AsyncIterable<Uint8Array>) {
    chunks.push(chunk)
  }
  const buf = Buffer.concat(chunks)
  writeFileSync('/tmp/watermark.png', buf)
  console.log(`Downloaded ${buf.length} bytes to /tmp/watermark.png`)
}

main().catch((err) => {
  console.error('Download failed:', err)
  process.exit(1)
})
