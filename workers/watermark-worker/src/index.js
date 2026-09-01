import { AwsClient } from 'aws4fetch'
import { eventIdFromObjectPath, gravityFromQuery, resolveWatermarkUrl } from './watermark-url.js'

// ─── Preset maps ───────────────────────────────────────────────────────────

// `fit: cover` only crops when both sides are given: with a width alone Cloudflare just scales the
// image and keeps its original ratio, which left the 16:9 framing to the browser's object-fit and
// made the organiser's focal point pointless. These heights are the 16:9 counterpart of each width.
const ASSET_PRESETS = {
  'cover-sm': { width: 400, height: 225, quality: 80, fit: 'cover', format: 'auto' },
  'cover-lg': { width: 1200, height: 675, quality: 85, fit: 'cover', format: 'auto' },
}

// Every gallery render is 800px wide, so a fixed tile width is what keeps the mosaic identical
// across tenants: without it Cloudflare draws the PNG at its native pixel size, and a 2000px logo
// covers the whole photo while a 100px one tiles into noise.
//
// 380 is the platform's own watermark asset, whose density is the one already validated in
// production. Anything smaller crowds the photo: 200 tiled it five across and buried the rider.
const DEFAULT_WATERMARK_TILE_WIDTH = 380

const INTERNAL_PRESETS = {
  thumb: { width: 400, quality: 80, fit: 'scale-down', format: 'auto' },
  workspace: { width: 1400, quality: 90, fit: 'scale-down', format: 'auto' },
  embedding: { width: 1600, quality: 75, fit: 'scale-down', format: 'jpeg' },
}

// ─── HMAC helpers ──────────────────────────────────────────────────────────

async function importHmacKey(secret) {
  const enc = new TextEncoder()
  return crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify'],
  )
}

function hexToBuffer(hex) {
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16)
  }
  return bytes
}

/**
 * Validates HMAC token from ?token={expiration}-{hexHmac}.
 * Data signed: pathname + expiration (same as backend CdnUrlBuilder).
 */
async function verifyHmacToken(url, secret) {
  const token = url.searchParams.get('token')
  if (!token) return { valid: false, reason: 'missing token' }

  const dashIdx = token.indexOf('-')
  if (dashIdx === -1) return { valid: false, reason: 'malformed token' }

  const expiration = parseInt(token.substring(0, dashIdx), 10)
  const hmacHex = token.substring(dashIdx + 1)

  if (Number.isNaN(expiration)) return { valid: false, reason: 'invalid expiration' }
  if (Math.floor(Date.now() / 1000) > expiration) return { valid: false, reason: 'expired' }

  const key = await importHmacKey(secret)
  const enc = new TextEncoder()
  const data = enc.encode(url.pathname + expiration)
  const sigBytes = hexToBuffer(hmacHex)

  const valid = await crypto.subtle.verify('HMAC', key, sigBytes, data)
  return valid ? { valid: true } : { valid: false, reason: 'invalid signature' }
}

// ─── Response helpers ──────────────────────────────────────────────────────

function sanitizeResponse(original) {
  const headers = new Headers()
  const allowed = ['content-type', 'content-length', 'etag', 'last-modified', 'cf-resized']
  for (const name of allowed) {
    if (original.headers.has(name)) headers.set(name, original.headers.get(name))
  }
  headers.set('Cache-Control', 'public, max-age=86400')
  headers.set('X-Content-Type-Options', 'nosniff')
  return new Response(original.body, { status: original.status, headers })
}

function forbidden(reason) {
  return new Response(JSON.stringify({ error: 'Forbidden', reason }), {
    status: 403,
    headers: { 'content-type': 'application/json' },
  })
}

// ─── B2 helpers ────────────────────────────────────────────────────────────

function getB2Client(env) {
  return new AwsClient({
    accessKeyId: env.B2_KEY_ID,
    secretAccessKey: env.B2_APP_KEY,
    region: env.B2_REGION,
    service: 's3',
  })
}

function getB2Url(env, objectPath) {
  return `https://${env.B2_BUCKET}.s3.${env.B2_REGION}.backblazeb2.com/${objectPath}`
}

async function serveKvAsset(env, key, contentType) {
  const data = await env.IMAGE_MAP.get(key, 'arrayBuffer')
  if (!data) return new Response('Not Found', { status: 404 })
  return new Response(data, {
    headers: {
      'content-type': contentType,
      'cache-control': 'public, max-age=31536000, immutable',
    },
  })
}

// ─── Image fetchers ────────────────────────────────────────────────────────

/** Resolves slug → B2 path, signs request, fetches original. */
async function fetchOriginal(slug, env) {
  const objectPath = await env.IMAGE_MAP.get(slug)
  if (!objectPath) return new Response('Not Found', { status: 404 })

  const b2 = getB2Client(env)
  const signedReq = await b2.sign(getB2Url(env, objectPath))
  const response = await fetch(signedReq)

  if (!response.ok) {
    return response.status === 404
      ? new Response('Not Found', { status: 404 })
      : new Response('Bad Gateway', { status: 502 })
  }

  return sanitizeResponse(response)
}

/** Resolves slug → B2 path, signs request, applies cf.image preset transform. */
async function fetchWithPreset(slug, presetOptions, env, gravity) {
  const objectPath = await env.IMAGE_MAP.get(slug)
  if (!objectPath) return new Response('Not Found', { status: 404 })

  // Gravity only means anything to a cropping fit; on the others it would be silently dropped.
  const options =
    gravity && presetOptions.fit === 'cover' ? { ...presetOptions, gravity } : presetOptions

  const b2 = getB2Client(env)
  const originUrl = getB2Url(env, objectPath)
  const signedReq = await b2.sign(originUrl)

  const response = await fetch(originUrl, {
    headers: signedReq.headers,
    cf: {
      image: { ...options, 'origin-auth': 'share-publicly' },
      cacheEverything: true,
      cacheTtl: 604800,
      // The subrequest URL is the same B2 object whatever the crop, so the origin has to carry the
      // framing too. Without it the edge would answer every re-frame with the first crop it cached.
      cacheKey: `${originUrl}#${slug}-${gravity ? `${gravity.x}x${gravity.y}` : 'centre'}`,
    },
  })

  if (!response.ok) {
    return response.status === 404
      ? new Response('Not Found', { status: 404 })
      : new Response('Bad Gateway', { status: 502 })
  }

  return sanitizeResponse(response)
}

/** Resolves slug → B2 path, signs request, applies watermark + QR + quality degradation. */
async function fetchWatermarked(slug, env) {
  const objectPath = await env.IMAGE_MAP.get(slug)
  if (!objectPath) return new Response('Not Found', { status: 404 })

  const b2 = getB2Client(env)
  const originUrl = getB2Url(env, objectPath)
  const signedReq = await b2.sign(originUrl)

  const eventId = eventIdFromObjectPath(objectPath)
  const wmPath = eventId ? await env.IMAGE_MAP.get(`wm-${eventId}`) : null
  const watermarkUrl = resolveWatermarkUrl(eventId, wmPath, env.PUBLIC_DOMAIN)
  const publicUrl = `https://${env.PUBLIC_DOMAIN}/gallery/${slug}.jpg`
  const qrUrl = `https://${env.QR_WORKER_HOST}/?url=${encodeURIComponent(publicUrl)}&v=2`

  const response = await fetch(originUrl, {
    headers: signedReq.headers,
    cf: {
      image: {
        width: 800,
        quality: parseInt(env.DEFAULT_QUALITY, 10) || 40,
        format: 'jpeg',
        draw: [
          {
            url: watermarkUrl,
            repeat: true,
            opacity: parseFloat(env.WATERMARK_OPACITY) || 0.3,
            width: parseInt(env.WATERMARK_TILE_WIDTH, 10) || DEFAULT_WATERMARK_TILE_WIDTH,
          },
          {
            url: qrUrl,
            bottom: 15,
            left: 15,
            width: 130,
            height: 130,
            opacity: 1.0,
            background: '#ffffff',
          },
        ],
        'origin-auth': 'share-publicly',
      },
      cacheEverything: true,
      cacheTtl: 604800,
    },
  })

  if (!response.ok) {
    console.error(`B2 responded ${response.status} for gallery slug: ${slug}`)
    return response.status === 404
      ? new Response('Not Found', { status: 404 })
      : new Response('Bad Gateway', { status: 502 })
  }

  return sanitizeResponse(response)
}

// ─── Main router ───────────────────────────────────────────────────────────

const ROUTE_REGEX =
  /^\/(gallery|internal|assets)\/(?:([a-z0-9-]+)\/)?([a-zA-Z0-9_-]+)\.(?:jpg|png)$/

/**
 * Validates the Referer header to prevent hotlinking from unauthorized domains.
 * Allows: direct browser access (no referer), same-domain, and allowed origins.
 * ALLOWED_ORIGINS env var: comma-separated list (e.g., "http://localhost:5173,https://app.titantv.com.ec")
 */
function isAllowedReferer(request, env) {
  const referer = request.headers.get('referer')
  if (!referer) return true // Direct access (browser bar, curl) is OK

  const allowedOrigins = (env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean)
  allowedOrigins.push(`https://${env.PUBLIC_DOMAIN}`) // Always allow CDN domain itself

  try {
    const refererOrigin = new URL(referer).origin
    return allowedOrigins.some((allowed) => refererOrigin === allowed)
  } catch {
    return false
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url)

    // Referer check — block hotlinking from unauthorized domains
    if (!isAllowedReferer(request, env)) {
      return new Response('Forbidden', { status: 403 })
    }

    // Serve watermark PNG from KV
    if (url.pathname === '/gallery/_assets/watermark.png') {
      return serveKvAsset(env, '_asset:watermark', 'image/png')
    }

    const match = url.pathname.match(ROUTE_REGEX)
    if (!match) return new Response('Not Found', { status: 404 })

    const [, prefix, preset, slug] = match

    // ── /gallery/ — public, watermarked ──
    if (prefix === 'gallery') {
      return fetchWatermarked(slug, env)
    }

    // ── /internal/ — HMAC-protected ──
    if (prefix === 'internal') {
      const auth = await verifyHmacToken(url, env.HMAC_SECRET)
      if (!auth.valid) return forbidden(auth.reason)

      if (preset) {
        const presetOptions = INTERNAL_PRESETS[preset]
        if (!presetOptions) return new Response('Not Found', { status: 404 })
        return fetchWithPreset(slug, presetOptions, env, null)
      }
      return fetchOriginal(slug, env)
    }

    // ── /assets/ — public, optional preset ──
    if (prefix === 'assets') {
      if (preset) {
        const presetOptions = ASSET_PRESETS[preset]
        if (!presetOptions) return new Response('Not Found', { status: 404 })
        return fetchWithPreset(slug, presetOptions, env, gravityFromQuery(url.searchParams))
      }
      return fetchOriginal(slug, env)
    }

    return new Response('Not Found', { status: 404 })
  },
}
