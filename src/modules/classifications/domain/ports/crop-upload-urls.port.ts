import type { CropUploadUrls } from '@shared/ai-pipeline'

/** Maximum number of preallocated signed PUT URLs per crop type, per photo. */
export const CROP_UPLOAD_MAX_PER_TYPE = 10

/** TTL (seconds) applied to each signed PUT URL handed to the AI pipeline. */
export const CROP_UPLOAD_TTL_SECONDS = 600

export interface ICropUploadUrlsService {
  /** Generate one batch of signed PUT URLs (10 × 4 types) for a single photo. */
  generate(photoId: string, eventId: string): Promise<CropUploadUrls>
}

export const CROP_UPLOAD_URLS_SERVICE = Symbol('CROP_UPLOAD_URLS_SERVICE')
