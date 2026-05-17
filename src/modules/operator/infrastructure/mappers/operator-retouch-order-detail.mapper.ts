import type { CdnUrlBuilder } from '@shared/cloudflare/infrastructure'
import type {
  OperatorRetouchOrderDetailPhotoProjection,
  OperatorRetouchOrderDetailProjection,
} from '../../application/projections'
import type { OperatorRetouchOrderDetailRow } from '../../domain/ports'

export function toOperatorRetouchOrderDetailProjection(
  row: OperatorRetouchOrderDetailRow,
  cdn: CdnUrlBuilder,
): OperatorRetouchOrderDetailProjection {
  return {
    orderId: row.orderId,
    buyerName: row.buyerName,
    eventId: row.eventId,
    eventName: row.eventName,
    createdAt: row.createdAt.toISOString(),
    photos: row.photos.map(
      (photo): OperatorRetouchOrderDetailPhotoProjection => ({
        photoId: photo.photoId,
        publicSlug: photo.publicSlug,
        filename: photo.filename,
        thumbnailUrl: cdn.internalUrl(photo.publicSlug, 'thumb'),
        isRetouched: photo.retouchedStorageKey !== null,
      }),
    ),
  }
}
