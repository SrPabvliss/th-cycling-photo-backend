import { generatePngQrCode } from '@juit/qrcode'

export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    const targetUrl = url.searchParams.get('url')

    if (!targetUrl) {
      return new Response("Missing 'url' parameter", { status: 400 })
    }

    // Validate URL format
    let parsed
    try {
      parsed = new URL(targetUrl)
    } catch {
      return new Response('Invalid URL format', { status: 400 })
    }

    // Only allow QR codes for our own domains (prevent abuse)
    const allowedDomains = (env.ALLOWED_DOMAINS || '').split(',')
    if (!allowedDomains.some((d) => parsed.hostname.endsWith(d.trim()))) {
      return new Response('Domain not allowed', { status: 403 })
    }

    // Generate QR as PNG buffer (scale up for readability)
    const pngBuffer = await generatePngQrCode(targetUrl, { scale: 8, margin: 2 })

    return new Response(pngBuffer, {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=31536000, immutable',
        'Access-Control-Allow-Origin': '*',
      },
    })
  },
}
