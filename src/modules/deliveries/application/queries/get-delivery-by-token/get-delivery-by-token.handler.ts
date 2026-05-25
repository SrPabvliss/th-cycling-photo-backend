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
// Hard cap on how many times a single delivery token can return presigned
// URLs. Legitimate use is ~1 fetch per page load + occasional refresh; this
// cap blocks "shared link with 50 friends" abuse without burdening users.
const MAX_DELIVERY_ACCESSES = 50

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

    // Atomic access record + cap enforcement. Done as a single UPDATE so
    // concurrent requests cannot race past the cap (issue: parallel hits
    // would otherwise read the same `download_count` and both increment it
    // independently).
    const recorded = await this.writeRepo.tryRecordAccess(deliveryLink.id, MAX_DELIVERY_ACCESSES)
    if (!recorded) {
      throw new AppException('delivery.access_limit_exceeded', HttpStatus.GONE)
    }

    // Get delivery data with photos (returns raw with storageKey)
    const data = await this.readRepo.getDeliveryData(query.token)
    if (!data) throw AppException.notFound('entities.delivery_link', query.token)

    // Transform: generate presigned download URLs from storageKey.
    // Use generic filenames to avoid exposing original camera filenames.
    const photos = await Promise.all(
      data.photos.map(async (photo, index) => {
        const safeFilename = `photo-${index + 1}.jpg`
        return {
          id: photo.id,
          filename: safeFilename,
          fileSize: photo.fileSize,
          downloadUrl: await this.storage.getPresignedDownloadUrl({
            key: photo.storageKey,
            filename: safeFilename,
            expiresIn: PRESIGNED_URL_EXPIRY_SECONDS,
          }),
        }
      }),
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
