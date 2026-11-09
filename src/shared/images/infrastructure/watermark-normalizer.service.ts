import { Inject, Injectable, Logger } from '@nestjs/common'
import { type IStorageAdapter, STORAGE_ADAPTER } from '@shared/storage/domain/ports'
import sharp from 'sharp'
import { canvasFor, needsMargin } from '../domain/watermark-canvas'

const PNG = 'image/png'

/**
 * The browser caps a watermark at 2 MB, but the upload goes straight to storage on a presigned URL,
 * so nothing on the server has seen the bytes before this point. These bounds keep a hand-crafted
 * request from turning a decode into a memory problem.
 */
const MAX_BYTES = 8 * 1024 * 1024
const MAX_PIXELS = 40_000_000

@Injectable()
export class WatermarkNormalizer {
  private readonly logger = new Logger(WatermarkNormalizer.name)

  constructor(@Inject(STORAGE_ADAPTER) private readonly storage: IStorageAdapter) {}

  /**
   * Re-centres an uploaded watermark on a canvas with breathing room, overwriting it in place so
   * the storage key the caller already holds stays valid.
   *
   * A failure here is deliberately not fatal: the mark still works, it just tiles tighter than it
   * should, and losing the upload over cosmetics would be worse.
   */
  async normalize(storageKey: string): Promise<void> {
    try {
      const original = await this.storage.download(storageKey)
      const normalized = await this.addMargin(original)
      if (!normalized) return

      await this.storage.upload({ buffer: normalized, key: storageKey, contentType: PNG })
    } catch (error) {
      this.logger.error(
        `Could not add margin to watermark ${storageKey} — using it as uploaded`,
        error,
      )
    }
  }

  private async addMargin(original: Buffer): Promise<Buffer | null> {
    if (original.byteLength > MAX_BYTES) return null

    const source = sharp(original, { limitInputPixels: MAX_PIXELS })
    const canvas = await source.metadata()
    if (!canvas.width || !canvas.height) return null

    const trimmed = await source.clone().trim().toBuffer({ resolveWithObject: true })
    const content = { width: trimmed.info.width, height: trimmed.info.height }
    if (!needsMargin(content, { width: canvas.width, height: canvas.height })) return null

    const target = canvasFor(content)

    return sharp({
      create: {
        width: target.width,
        height: target.height,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      },
    })
      .composite([{ input: trimmed.data, gravity: 'centre' }])
      .png()
      .toBuffer()
  }
}
