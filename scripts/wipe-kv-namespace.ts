/**
 * Deletes every USER key in the Workers KV namespace IMAGE_MAP (dev only).
 *
 * Keys prefixed with `_asset:` are SYSTEM assets (e.g. the watermark PNG
 * served by the Worker) and are preserved. If you truly need to wipe those
 * too, pass `--include-system`.
 *
 * Run with: npx tsx scripts/wipe-kv-namespace.ts
 *
 * ⚠ DESTRUCTIVE — removes all slug→path mappings.
 */
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

const BASE = `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/storage/kv/namespaces/${CLOUDFLARE_KV_NAMESPACE_ID}`

const headers = {
  Authorization: `Bearer ${CLOUDFLARE_API_TOKEN}`,
  'Content-Type': 'application/json',
}

interface ListedKey {
  name: string
}
interface ListResult {
  result: ListedKey[]
  result_info?: { cursor?: string }
  success: boolean
  errors?: unknown[]
}

async function listKeys(cursor?: string): Promise<ListResult> {
  const url = new URL(`${BASE}/keys`)
  url.searchParams.set('limit', '1000')
  if (cursor) url.searchParams.set('cursor', cursor)

  const response = await fetch(url.toString(), { headers })
  if (!response.ok) {
    throw new Error(`KV list failed: ${response.status} ${await response.text()}`)
  }
  return response.json() as Promise<ListResult>
}

async function bulkDelete(keys: string[]): Promise<void> {
  if (keys.length === 0) return

  const response = await fetch(`${BASE}/bulk/delete`, {
    method: 'POST',
    headers,
    body: JSON.stringify(keys),
  })

  if (!response.ok) {
    throw new Error(`KV bulk delete failed: ${response.status} ${await response.text()}`)
  }
}

const includeSystem = process.argv.includes('--include-system')

async function wipe() {
  let cursor: string | undefined
  let totalDeleted = 0
  let totalPreserved = 0
  let batch = 0

  do {
    const result = await listKeys(cursor)
    const allKeys = result.result.map((k) => k.name)
    if (allKeys.length === 0) break

    const keysToDelete = includeSystem ? allKeys : allKeys.filter((k) => !k.startsWith('_asset:'))
    const preserved = allKeys.length - keysToDelete.length

    if (keysToDelete.length > 0) {
      await bulkDelete(keysToDelete)
    }
    totalDeleted += keysToDelete.length
    totalPreserved += preserved
    batch += 1
    console.log(
      `Batch ${batch}: deleted ${keysToDelete.length} keys, preserved ${preserved} system keys (total deleted ${totalDeleted})`,
    )

    cursor = result.result_info?.cursor || undefined
  } while (cursor)

  console.log(`Done. Deleted ${totalDeleted} KV entries, preserved ${totalPreserved} system keys.`)
}

wipe().catch((err) => {
  console.error('Wipe failed:', err)
  process.exit(1)
})
