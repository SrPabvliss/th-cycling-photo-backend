export default {
  async fetch(request, env) {
    // Loop prevention: Image Transforms adds "image-resizing" to Via header
    // when fetching overlay URLs. If present, pass through to origin.
    const via = request.headers.get('via') || ''
    if (via.includes('image-resizing')) {
      return fetch(request)
    }

    const url = new URL(request.url)

    // Extract photo path: /photos/watermarked/events/xxx/photo.jpg → events/xxx/photo.jpg
    const photoPath = url.pathname.replace('/photos/watermarked/', '')

    if (!photoPath || photoPath === url.pathname) {
      return new Response('Not found', { status: 404 })
    }

    // Construct B2 origin URL (S3-compatible, direct to B2, bypasses Cloudflare)
    const originUrl = `https://${env.B2_ORIGIN_HOST}/${photoPath}`

    // Construct public URL that the QR code will encode
    const publicUrl = `https://${env.PUBLIC_DOMAIN}/photos/watermarked/${photoPath}`

    // Construct QR Worker URL — generates QR PNG on demand
    const qrUrl = `https://${env.QR_WORKER_HOST}/?url=${encodeURIComponent(publicUrl)}&v=2`

    try {
      const response = await fetch(originUrl, {
        cf: {
          image: {
            width: 800,
            quality: parseInt(env.DEFAULT_QUALITY) || 40,
            format: 'jpeg',
            draw: [
              {
                url: env.WATERMARK_URL,
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
          },
        },
      })

      if (!response.ok) {
        console.error(`Image transform failed: ${response.status} ${response.statusText}`)
        return fetch(originUrl)
      }

      // Add cache headers for downstream caches
      const result = new Response(response.body, response)
      result.headers.set('Cache-Control', 'public, max-age=86400')
      return result
    } catch (err) {
      console.error(`Watermark error: ${err.message}`)
      return fetch(originUrl)
    }
  },
}
