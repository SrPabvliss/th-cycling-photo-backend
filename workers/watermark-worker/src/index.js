import { AwsClient } from 'aws4fetch'

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

/**
 * Resolves slug → B2 path, signs request, fetches original image.
 * No transforms, no quality loss. Used for /internal/ and via subrequests.
 */
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

/**
 * Resolves slug → B2 path, signs request, applies watermark + QR + quality degradation.
 * Buyer must NOT get a usable image from this endpoint.
 */
async function fetchWatermarked(slug, env) {
  const objectPath = await env.IMAGE_MAP.get(slug)
  if (!objectPath) return new Response('Not Found', { status: 404 })

  const b2 = getB2Client(env)
  const signedReq = await b2.sign(getB2Url(env, objectPath))

  const watermarkUrl = `https://${env.PUBLIC_DOMAIN}/gallery/_assets/watermark.png`
  const publicUrl = `https://${env.PUBLIC_DOMAIN}/gallery/${slug}.jpg`
  const qrUrl = `https://${env.QR_WORKER_HOST}/?url=${encodeURIComponent(publicUrl)}&v=2`

  const response = await fetch(signedReq.url, {
    headers: signedReq.headers,
    cf: {
      image: {
        width: 800,
        quality: parseInt(env.DEFAULT_QUALITY) || 40,
        format: 'jpeg',
        draw: [
          {
            url: watermarkUrl,
            repeat: true,
            opacity: parseFloat(env.WATERMARK_OPACITY) || 0.3,
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

export default {
  async fetch(request, env) {
    const url = new URL(request.url)

    if (url.pathname === '/gallery/_assets/watermark.png') {
      return serveKvAsset(env, '_asset:watermark', 'image/png')
    }

    const match = url.pathname.match(/^\/(gallery|internal|assets)\/([a-zA-Z0-9_-]+)\.jpg$/)
    if (!match) return new Response('Not Found', { status: 404 })

    const [, prefix, slug] = match

    if (prefix === 'internal' || prefix === 'assets') {
      return fetchOriginal(slug, env)
    }

    const via = request.headers.get('via') || ''
    if (via.includes('image-resizing')) {
      return fetchOriginal(slug, env)
    }

    return fetchWatermarked(slug, env)
  },
}
