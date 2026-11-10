import { Inject, Injectable } from '@nestjs/common'
import type { CropUploadUrls } from '@shared/ai-pipeline'
import {
  type IStorageAdapter,
  STORAGE_ADAPTER,
} from '@shared/storage/domain/ports/storage-adapter.port'
import {
  CROP_UPLOAD_MAX_PER_TYPE,
  CROP_UPLOAD_TTL_SECONDS,
  type ICropUploadUrlsService,
} from '../../domain/ports/crop-upload-urls.port'

@Injectable()
export class CropUploadUrlsService implements ICropUploadUrlsService {
  constructor(@Inject(STORAGE_ADAPTER) private readonly storage: IStorageAdapter) {}

  async generate(photoId: string, eventId: string): Promise<CropUploadUrls> {
    const keys = Array.from(
      { length: CROP_UPLOAD_MAX_PER_TYPE },
      (_, idx) => `events/${eventId}/photos/${photoId}/crops/bibs/${idx}.jpg`,
    )

    const signed = await Promise.all(
      keys.map((key) =>
        this.storage.getPresignedUrl({
          key,
          contentType: 'image/jpeg',
          expiresIn: CROP_UPLOAD_TTL_SECONDS,
        }),
      ),
    )

    const result: CropUploadUrls = {
      bibs: signed.map((s) => s.url),
      colorsHelmet: [],
      colorsClothes: [],
      colorsBicycle: [],
    }
    return result
  }
}
