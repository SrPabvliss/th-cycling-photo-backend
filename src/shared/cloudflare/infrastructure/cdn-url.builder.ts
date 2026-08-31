import { createHmac } from 'node:crypto'
import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

function versionOf(storageKey: string): string {
  return encodeURIComponent(storageKey.split('/').pop() ?? '')
}

export type InternalPreset = 'thumb' | 'workspace' | 'embedding'
export type AssetPreset = 'cover-sm' | 'cover-lg'

@Injectable()
export class CdnUrlBuilder {
  private readonly baseUrl: string
  private readonly hmacSecret: string

  constructor(config: ConfigService) {
    this.baseUrl = config.getOrThrow<string>('storage.cdnUrl')
    this.hmacSecret = config.getOrThrow<string>('cloudflare.hmacSecret')
  }

  /** Public gallery URL — Worker applies watermark + quality degradation. */
  galleryUrl(slug: string): string {
    return `${this.baseUrl}/gallery/${slug}.jpg`
  }

  /** HMAC-signed internal URL — Worker validates token before serving. */
  internalUrl(slug: string, preset?: InternalPreset): string {
    const presetSegment = preset ? `${preset}/` : ''
    const pathname = `/internal/${presetSegment}${slug}.jpg`
    return `${this.baseUrl}${pathname}${this.signUrl(pathname)}`
  }

  /**
   * Public event asset URL with optional Worker-handled preset. The crop origin rides in the query
   * rather than in KV: Workers KV caches every read at the edge for at least a minute, so a
   * re-framed cover kept serving the previous crop until that expired. In the URL it is read on the
   * spot, and it doubles as the cache key, so a new framing is a new address.
   */
  assetUrl(slug: string, preset?: AssetPreset, gravity?: string | null): string {
    const presetSegment = preset ? `${preset}/` : ''
    const query = gravity ? `?g=${encodeURIComponent(gravity)}` : ''
    return `${this.baseUrl}/assets/${presetSegment}${slug}.jpg${query}`
  }

  /** Crop origin in the `XxY` shape the Worker parses, short enough to read in a URL. */
  static focalGravity(focalX: number, focalY: number): string {
    return `${focalX.toFixed(3)}x${focalY.toFixed(3)}`
  }

  watermarkUrl(tenantId: string, storageKey: string): string {
    return `${this.baseUrl}/assets/wm-tenant-${tenantId}.png?v=${versionOf(storageKey)}`
  }

  /**
   * An event keeps its own frozen copy of the watermark, published under the
   * `wm-{eventId}` KV key. Resolving it through `watermarkUrl` would serve the
   * tenant's current one instead, which is a different image as soon as the
   * event was configured with its own.
   */
  eventWatermarkUrl(eventId: string, storageKey: string): string {
    return `${this.baseUrl}/assets/wm-${eventId}.png?v=${versionOf(storageKey)}`
  }

  /**
   * Generates HMAC token: ?token={expiration}-{hexHmac}.
   * Internal-URL TTL kept short on purpose: frontend queries holding these
   * URLs refresh well before expiry (see INTERNAL_IMAGE_QUERY_DEFAULTS on
   * the frontend); shorter TTL limits the replay window if a payload leaks.
   */
  private signUrl(pathname: string): string {
    const expiration = Math.floor(Date.now() / 1000) + 600
    const data = `${pathname}${expiration}`
    const hmac = createHmac('sha256', this.hmacSecret).update(data).digest('hex')
    return `?token=${expiration}-${hmac}`
  }
}
