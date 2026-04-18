/**
 * Configures B2 bucket lifecycle rules to auto-purge hidden (deleted) file versions.
 *
 * Usage:
 *   npx tsx scripts/configure-b2-lifecycle.ts [days]
 *
 * - Default: 7 days (production)
 * - For testing: npx tsx scripts/configure-b2-lifecycle.ts 0
 *   (0 days = purge on next lifecycle pass, B2 runs every ~24h but hidden files
 *    become inaccessible immediately)
 */

import {
  GetBucketLifecycleConfigurationCommand,
  PutBucketLifecycleConfigurationCommand,
  S3Client,
} from '@aws-sdk/client-s3'
import { config } from 'dotenv'

const env = process.env.NODE_ENV || 'development'
config({ path: `.env.${env}` })
config({ path: '.env' })

const { B2_APPLICATION_KEY_ID, B2_APPLICATION_KEY, B2_BUCKET_NAME, B2_REGION } = process.env

if (!B2_APPLICATION_KEY_ID || !B2_APPLICATION_KEY || !B2_BUCKET_NAME || !B2_REGION) {
  console.error(
    'Missing required B2 env vars: B2_APPLICATION_KEY_ID, B2_APPLICATION_KEY, B2_BUCKET_NAME, B2_REGION',
  )
  process.exit(1)
}

const daysArg = process.argv[2]
const days = daysArg !== undefined ? Number.parseInt(daysArg, 10) : 7

if (Number.isNaN(days) || days < 1) {
  console.error('Days must be a positive integer (minimum 1)')
  process.exit(1)
}

const client = new S3Client({
  endpoint: `https://s3.${B2_REGION}.backblazeb2.com`,
  region: B2_REGION,
  credentials: {
    accessKeyId: B2_APPLICATION_KEY_ID,
    secretAccessKey: B2_APPLICATION_KEY,
  },
  requestChecksumCalculation: 'WHEN_REQUIRED',
  responseChecksumValidation: 'WHEN_REQUIRED',
})

async function main() {
  console.log(`Configuring lifecycle for bucket: ${B2_BUCKET_NAME}`)
  console.log(`NoncurrentVersionExpiration: ${days} day(s)`)

  await client.send(
    new PutBucketLifecycleConfigurationCommand({
      Bucket: B2_BUCKET_NAME,
      LifecycleConfiguration: {
        Rules: [
          {
            ID: 'purge-hidden-versions',
            Status: 'Enabled',
            Filter: { Prefix: '' },
            NoncurrentVersionExpiration: {
              NoncurrentDays: days,
            },
          },
        ],
      },
    }),
  )

  console.log('Lifecycle rule applied. Verifying...')

  const result = await client.send(
    new GetBucketLifecycleConfigurationCommand({ Bucket: B2_BUCKET_NAME }),
  )

  console.log('Current lifecycle rules:')
  for (const rule of result.Rules ?? []) {
    console.log(
      `  - ${rule.ID}: NoncurrentDays=${rule.NoncurrentVersionExpiration?.NoncurrentDays}, Status=${rule.Status}`,
    )
  }

  console.log('Done.')
}

main().catch((err) => {
  console.error('Failed to configure lifecycle:', err)
  process.exit(1)
})
