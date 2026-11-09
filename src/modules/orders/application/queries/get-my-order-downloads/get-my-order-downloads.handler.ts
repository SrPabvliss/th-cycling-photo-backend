import { Inject } from '@nestjs/common'
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs'
import type { MyOrderDownloadsProjection } from '@orders/application/projections'
import { type IOrderReadRepository, ORDER_READ_REPOSITORY } from '@orders/domain/ports'
import { AppException } from '@shared/domain'
import { type IStorageAdapter, STORAGE_ADAPTER } from '@shared/storage/domain/ports'
import { GetMyOrderDownloadsQuery } from './get-my-order-downloads.query'

const PRESIGNED_URL_EXPIRY_SECONDS = 3600

@QueryHandler(GetMyOrderDownloadsQuery)
export class GetMyOrderDownloadsHandler implements IQueryHandler<GetMyOrderDownloadsQuery> {
  constructor(
    @Inject(ORDER_READ_REPOSITORY) private readonly readRepo: IOrderReadRepository,
    @Inject(STORAGE_ADAPTER) private readonly storage: IStorageAdapter,
  ) {}

  async execute(query: GetMyOrderDownloadsQuery): Promise<MyOrderDownloadsProjection> {
    const files = await this.readRepo.getMyDownloadFiles(query.userId, query.orderId)

    if (!files) {
      const exists = await this.readRepo.getMyDetail(query.userId, query.orderId)
      if (!exists) throw AppException.notFound('entities.order', query.orderId)
      throw AppException.businessRule('order.not_downloadable')
    }

    const photos = await Promise.all(
      files.map(async (file, index) => {
        const filename = `photo-${index + 1}.jpg`
        return {
          id: file.id,
          filename,
          fileSize: file.fileSize,
          downloadUrl: await this.storage.getPresignedDownloadUrl({
            key: file.storageKey,
            filename,
            expiresIn: PRESIGNED_URL_EXPIRY_SECONDS,
          }),
        }
      }),
    )

    return { orderId: query.orderId, photos }
  }
}
