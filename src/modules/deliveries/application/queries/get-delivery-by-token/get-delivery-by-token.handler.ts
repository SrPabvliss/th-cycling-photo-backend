import type { DeliveryDataProjection } from '@deliveries/application/projections'
import {
  DELIVERY_LINK_READ_REPOSITORY,
  DELIVERY_LINK_WRITE_REPOSITORY,
  type IDeliveryLinkReadRepository,
  type IDeliveryLinkWriteRepository,
} from '@deliveries/domain/ports'
import { HttpStatus, Inject } from '@nestjs/common'
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs'
import { AppException } from '@shared/domain'
import { type IStorageAdapter, STORAGE_ADAPTER } from '@shared/storage/domain/ports'
import { GetDeliveryByTokenQuery } from './get-delivery-by-token.query'

const PRESIGNED_URL_EXPIRY_SECONDS = 3600 // 1 hour

@QueryHandler(GetDeliveryByTokenQuery)
export class GetDeliveryByTokenHandler implements IQueryHandler<GetDeliveryByTokenQuery> {
  constructor(
    @Inject(DELIVERY_LINK_READ_REPOSITORY) private readonly readRepo: IDeliveryLinkReadRepository,
    @Inject(DELIVERY_LINK_WRITE_REPOSITORY)
    private readonly writeRepo: IDeliveryLinkWriteRepository,
    @Inject(STORAGE_ADAPTER) private readonly storage: IStorageAdapter,
  ) {}

  async execute(query: GetDeliveryByTokenQuery): Promise<DeliveryDataProjection> {
    // Find delivery link entity
    const deliveryLink = await this.readRepo.findByToken(query.token)
    if (!deliveryLink) throw AppException.notFound('entities.delivery_link', query.token)

    // Lazy expiration check
    if (deliveryLink.checkExpiration()) {
      await this.writeRepo.save(deliveryLink)
      throw new AppException('delivery.link_expired', HttpStatus.GONE)
    }

    // Record access (first_downloaded_at + download_count + status)
    deliveryLink.recordAccess()
    await this.writeRepo.save(deliveryLink)

    // Get delivery data with photos (returns raw with storageKey)
    const data = await this.readRepo.getDeliveryData(query.token)
    if (!data) throw AppException.notFound('entities.delivery_link', query.token)

    // Transform: generate presigned download URLs from storageKey
    const photos = await Promise.all(
      data.photos.map(async (photo) => ({
        id: photo.id,
        filename: photo.filename,
        fileSize: photo.fileSize,
        downloadUrl: await this.storage.getPresignedDownloadUrl({
          key: photo.storageKey,
          filename: photo.filename,
          expiresIn: PRESIGNED_URL_EXPIRY_SECONDS,
        }),
      })),
    )

    return {
      token: data.token,
      eventName: data.eventName,
      customerName: data.customerName,
      status: data.status,
      expiresAt: data.expiresAt,
      downloadCount: data.downloadCount,
      photos,
    }
  }
}
