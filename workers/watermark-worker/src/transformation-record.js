const IGNORED_OPTIONS = new Set(['format', 'quality', 'origin-auth'])

export function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`
  if (value !== null && typeof value === 'object') {
    const entries = Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
    return `{${entries.join(',')}}`
  }
  return JSON.stringify(value)
}

export async function combinationKey(originUrl, imageOptions) {
  const options = Object.fromEntries(
    Object.entries(imageOptions).filter(([name]) => !IGNORED_OPTIONS.has(name)),
  )
  const bytes = new TextEncoder().encode(canonicalJson({ origin: originUrl, options }))
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

export function recordTransformation(env, { key, kind, slug, preset }) {
  try {
    env.TRANSFORMATIONS?.writeDataPoint({ indexes: [key], blobs: [kind, slug, preset] })
  } catch {
    // Telemetry must never break image delivery.
  }
}
