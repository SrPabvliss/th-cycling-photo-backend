/**
 * Deletes every object in the B2 bucket (dev only).
 *
 * Uses the ttv-backend-upload key (which has delete permissions).
 * Run with: npx tsx scripts/wipe-b2-bucket.ts
 *
 * ⚠ DESTRUCTIVE — irreversibly removes all files. Only for dev.
 */
import { config } from 'dotenv'

const env = process.env.NODE_ENV || 'development'
config({ path: `.env.${env}` })
config({ path: '.env' })

import { DeleteObjectsCommand, ListObjectsV2Command, S3Client } from '@aws-sdk/client-s3'

const {
  B2_APPLICATION_KEY_ID,
  B2_APPLICATION_KEY,
  B2_BUCKET_NAME,
  B2_REGION = 'us-east-005',
} = process.env

if (!B2_APPLICATION_KEY_ID || !B2_APPLICATION_KEY || !B2_BUCKET_NAME) {
  console.error('Missing B2_APPLICATION_KEY_ID, B2_APPLICATION_KEY, or B2_BUCKET_NAME')
  process.exit(1)
}

if (B2_BUCKET_NAME.includes('prod')) {
  console.error(`Refusing to wipe a bucket named "${B2_BUCKET_NAME}" — looks like prod.`)
  process.exit(1)
}

const s3 = new S3Client({
  region: B2_REGION,
  endpoint: `https://s3.${B2_REGION}.backblazeb2.com`,
  credentials: {
    accessKeyId: B2_APPLICATION_KEY_ID,
    secretAccessKey: B2_APPLICATION_KEY,
  },
})

async function wipe() {
  let continuationToken: string | undefined
  let totalDeleted = 0
  let batch = 0

  do {
    const listed = await s3.send(
      new ListObjectsV2Command({
        Bucket: B2_BUCKET_NAME,
        ContinuationToken: continuationToken,
        MaxKeys: 1000,
      }),
    )

    const objects = listed.Contents ?? []
    if (objects.length === 0) break

    const keys = objects.map((o) => ({ Key: o.Key! }))
    await s3.send(
      new DeleteObjectsCommand({
        Bucket: B2_BUCKET_NAME,
        Delete: { Objects: keys, Quiet: true },
      }),
    )

    totalDeleted += keys.length
    batch += 1
    console.log(`Batch ${batch}: deleted ${keys.length} objects (total ${totalDeleted})`)

    continuationToken = listed.IsTruncated ? listed.NextContinuationToken : undefined
  } while (continuationToken)

  console.log(`Done. Deleted ${totalDeleted} objects from ${B2_BUCKET_NAME}.`)
}

wipe().catch((err) => {
  console.error('Wipe failed:', err)
  process.exit(1)
})
