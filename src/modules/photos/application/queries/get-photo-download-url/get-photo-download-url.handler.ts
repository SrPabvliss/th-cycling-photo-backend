import { Inject } from '@nestjs/common'
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs'
import type { DownloadUrlProjection } from '@photos/application/projections'
import { type IPhotoReadRepository, PHOTO_READ_REPOSITORY } from '@photos/domain/ports'
import { AppException } from '@shared/domain'
import { type IStorageAdapter, STORAGE_ADAPTER } from '@shared/storage/domain/ports'
import { GetPhotoDownloadUrlQuery } from './get-photo-download-url.query'

@QueryHandler(GetPhotoDownloadUrlQuery)
export class GetPhotoDownloadUrlHandler implements IQueryHandler<GetPhotoDownloadUrlQuery> {
  constructor(
    @Inject(PHOTO_READ_REPOSITORY) private readonly photoReadRepo: IPhotoReadRepository,
    @Inject(STORAGE_ADAPTER) private readonly storage: IStorageAdapter,
  ) {}

  async execute(query: GetPhotoDownloadUrlQuery): Promise<DownloadUrlProjection> {
    const photo = await this.photoReadRepo.findById(query.photoId)
    if (!photo) throw AppException.notFound('Photo', query.photoId)

    let storageKey: string

    if (query.type === 'retouched') {
      if (!photo.retouchedStorageKey) {
        throw AppException.notFound('Retouched photo', query.photoId)
      }
      storageKey = photo.retouchedStorageKey
    } else {
      storageKey = photo.storageKey
    }

    const url = this.storage.getPublicUrl(storageKey)
    return { url }
  }
}
