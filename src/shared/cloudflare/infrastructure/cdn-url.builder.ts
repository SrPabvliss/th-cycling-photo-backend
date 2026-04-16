import { createHmac } from 'node:crypto'
import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

export type InternalPreset = 'thumb' | 'workspace'
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

  /** Public event asset URL with optional Worker-handled preset. */
  assetUrl(slug: string, preset?: AssetPreset): string {
    const presetSegment = preset ? `${preset}/` : ''
    return `${this.baseUrl}/assets/${presetSegment}${slug}.jpg`
  }

  /** Generates HMAC token: ?token={expiration}-{hexHmac} */
  private signUrl(pathname: string): string {
    const expiration = Math.floor(Date.now() / 1000) + 3600
    const data = `${pathname}${expiration}`
    const hmac = createHmac('sha256', this.hmacSecret).update(data).digest('hex')
    return `?token=${expiration}-${hmac}`
  }
}
