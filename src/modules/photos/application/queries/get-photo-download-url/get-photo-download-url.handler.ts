import { Inject } from '@nestjs/common'
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs'
import type { DownloadUrlProjection } from '@photos/application/projections'
import { type IPhotoReadRepository, PHOTO_READ_REPOSITORY } from '@photos/domain/ports'
import {
  AUTHORIZATION_SERVICE,
  type IAuthorizationService,
} from '@shared/authorization/domain/ports/authorization.service.port'
import { AppException } from '@shared/domain'
import { type IStorageAdapter, STORAGE_ADAPTER } from '@shared/storage/domain/ports'
import { GetPhotoDownloadUrlQuery } from './get-photo-download-url.query'

@QueryHandler(GetPhotoDownloadUrlQuery)
export class GetPhotoDownloadUrlHandler implements IQueryHandler<GetPhotoDownloadUrlQuery> {
  constructor(
    @Inject(PHOTO_READ_REPOSITORY) private readonly photoReadRepo: IPhotoReadRepository,
    @Inject(STORAGE_ADAPTER) private readonly storage: IStorageAdapter,
    @Inject(AUTHORIZATION_SERVICE) private readonly authz: IAuthorizationService,
  ) {}

  async execute(query: GetPhotoDownloadUrlQuery): Promise<DownloadUrlProjection> {
    const scope = await this.authz.resolveEventScope(query.userId)
    const photo = await this.photoReadRepo.findByIdInScope(query.photoId, scope)
    if (!photo) throw AppException.notFound('Photo', query.photoId)
    await this.authz.assert(query.userId, 'photo.download', photo.eventId)

    let storageKey: string

    if (query.type === 'retouched') {
      if (!photo.retouchedStorageKey) {
        throw AppException.notFound('Retouched photo', query.photoId)
      }
      storageKey = photo.retouchedStorageKey
    } else {
      storageKey = photo.storageKey
    }

    const url = await this.storage.getPresignedDownloadUrl({
      key: storageKey,
      filename: photo.filename,
    })
    return { url }
  }
}
