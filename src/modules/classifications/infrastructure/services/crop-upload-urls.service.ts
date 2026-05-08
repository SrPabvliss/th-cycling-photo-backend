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

const SUB_PATHS: Record<keyof CropUploadUrls, string> = {
  bibs: 'bibs',
  colorsHelmet: 'colors/helmet',
  colorsClothes: 'colors/clothes',
  colorsBicycle: 'colors/bicycle',
}

@Injectable()
export class CropUploadUrlsService implements ICropUploadUrlsService {
  constructor(@Inject(STORAGE_ADAPTER) private readonly storage: IStorageAdapter) {}

  async generate(photoId: string, eventId: string): Promise<CropUploadUrls> {
    const tasks = (Object.keys(SUB_PATHS) as (keyof CropUploadUrls)[]).flatMap((field) =>
      Array.from({ length: CROP_UPLOAD_MAX_PER_TYPE }, (_, idx) => ({
        field,
        key: `events/${eventId}/photos/${photoId}/crops/${SUB_PATHS[field]}/${idx}.jpg`,
      })),
    )

    const signed = await Promise.all(
      tasks.map(({ key }) =>
        this.storage.getPresignedUrl({
          key,
          contentType: 'image/jpeg',
          expiresIn: CROP_UPLOAD_TTL_SECONDS,
        }),
      ),
    )

    const result: CropUploadUrls = {
      bibs: [],
      colorsHelmet: [],
      colorsClothes: [],
      colorsBicycle: [],
    }
    tasks.forEach((t, i) => {
      result[t.field].push(signed[i].url)
    })
    return result
  }
}
