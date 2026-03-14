import { Inject } from '@nestjs/common'
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs'
import { type IPhotoReadRepository, PHOTO_READ_REPOSITORY } from '@photos/domain/ports'
import { type IStorageAdapter, STORAGE_ADAPTER } from '@shared/storage/domain/ports'
import { GetDownloadManifestQuery } from './get-download-manifest.query'

interface DownloadManifestItem {
  filename: string
  downloadUrl: string
  fileSize: number
}

@QueryHandler(GetDownloadManifestQuery)
export class GetDownloadManifestHandler implements IQueryHandler<GetDownloadManifestQuery> {
  constructor(
    @Inject(PHOTO_READ_REPOSITORY) private readonly photoReadRepo: IPhotoReadRepository,
    @Inject(STORAGE_ADAPTER) private readonly storage: IStorageAdapter,
  ) {}

  async execute(
    query: GetDownloadManifestQuery,
  ): Promise<{ items: DownloadManifestItem[]; totalSize: number }> {
    const photos = await this.photoReadRepo.getAllPhotoKeysForEvent(query.eventId)

    const items = await Promise.all(
      photos.map(async (photo) => ({
        filename: photo.filename,
        downloadUrl: await this.storage.getPresignedDownloadUrl({
          key: photo.storageKey,
          filename: photo.filename,
        }),
        fileSize: photo.fileSize,
      })),
    )

    const totalSize = items.reduce((sum, item) => sum + item.fileSize, 0)
    return { items, totalSize }
  }
}
