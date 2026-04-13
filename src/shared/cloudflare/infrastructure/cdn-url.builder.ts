import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

/**
 * Builds CDN URLs for slug-based assets served by the Cloudflare Worker.
 *
 * The Worker handles three path prefixes, each with distinct semantics:
 *  - `/gallery/` — public, watermarked + degraded (buyers must not get usable originals)
 *  - `/internal/` — admin/operator, original quality, no watermark
 *  - `/assets/`  — public event assets (covers, logos), original, no watermark
 *
 * Consumers should never hardcode these paths or read `storage.cdnUrl` directly —
 * inject this builder instead. That keeps URL construction in one place and makes
 * the path → semantics mapping easy to audit.
 */
@Injectable()
export class CdnUrlBuilder {
  private readonly baseUrl: string

  constructor(config: ConfigService) {
    this.baseUrl = config.getOrThrow<string>('storage.cdnUrl')
  }

  /** Public gallery URL — Worker applies watermark + quality degradation. */
  galleryUrl(slug: string): string {
    return `${this.baseUrl}/gallery/${slug}.jpg`
  }

  /** Internal admin/operator URL — original quality, no watermark. */
  internalUrl(slug: string): string {
    return `${this.baseUrl}/internal/${slug}.jpg`
  }

  /** Public event asset URL (covers, logos, etc.) — original, no watermark. */
  assetUrl(slug: string): string {
    return `${this.baseUrl}/assets/${slug}.jpg`
  }
}
