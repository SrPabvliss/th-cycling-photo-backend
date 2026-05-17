import type { CdnUrlBuilder } from '@shared/cloudflare/infrastructure'
import type {
  OperatorRetouchOrderPreviewPhotoProjection,
  OperatorRetouchOrderProjection,
} from '../../application/projections'
import type { OperatorRetouchOrderRow } from '../../domain/ports'

export function toOperatorRetouchOrderProjection(
  row: OperatorRetouchOrderRow,
  cdn: CdnUrlBuilder,
): OperatorRetouchOrderProjection {
  return {
    orderId: row.orderId,
    buyerName: row.buyerName,
    eventId: row.eventId,
    eventName: row.eventName,
    createdAt: row.createdAt.toISOString(),
    pendingPhotosCount: row.pendingPhotosCount,
    totalPhotosCount: row.totalPhotosCount,
    retouchedPhotosCount: row.retouchedPhotosCount,
    previewPhotos: row.previewPhotos.map(
      (photo): OperatorRetouchOrderPreviewPhotoProjection => ({
        photoId: photo.photoId,
        publicSlug: photo.publicSlug,
        thumbnailUrl: cdn.internalUrl(photo.publicSlug, 'thumb'),
        filename: photo.filename,
      }),
    ),
  }
}

export function toOperatorRetouchOrdersList(
  items: OperatorRetouchOrderRow[],
  cdn: CdnUrlBuilder,
): OperatorRetouchOrderProjection[] {
  return items.map((row) => toOperatorRetouchOrderProjection(row, cdn))
}
