import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

@Injectable()
export class WatermarkUrlService {
  private readonly baseUrl: string

  constructor(config: ConfigService) {
    this.baseUrl = config.getOrThrow<string>('watermark.baseUrl')
  }

  /** Builds a watermarked photo URL from a storage key. */
  buildUrl(storageKey: string): string {
    return `${this.baseUrl}/${storageKey}`
  }
}
