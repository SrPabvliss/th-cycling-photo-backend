import type { CdnUrlBuilder } from '@shared/cloudflare/infrastructure'
import type {
  RetouchQueueItemProjection,
  RetouchQueueOrderProjection,
} from '../../application/projections'
import type { OperatorRetouchPhotoRow, OperatorRetouchQueueOrderRow } from '../../domain/ports'

function toItemProjection(
  photo: OperatorRetouchPhotoRow,
  cdn: CdnUrlBuilder,
): RetouchQueueItemProjection {
  return {
    photoId: photo.photoId,
    thumbnailUrl: cdn.internalUrl(photo.publicSlug, 'thumb'),
    isRetouched: photo.retouchedStorageKey !== null,
  }
}

function toOrderProjection(
  order: OperatorRetouchQueueOrderRow,
  cdn: CdnUrlBuilder,
): RetouchQueueOrderProjection {
  const items = order.items.map((item) => toItemProjection(item, cdn))
  return {
    orderId: order.orderId,
    buyerName: order.buyerName,
    eventId: order.eventId,
    eventName: order.eventName,
    createdAt: order.createdAt.toISOString(),
    totalItems: items.length,
    retouchedItems: items.filter((item) => item.isRetouched).length,
    items,
  }
}

export function toRetouchQueueOrdersList(
  rows: OperatorRetouchQueueOrderRow[],
  cdn: CdnUrlBuilder,
): RetouchQueueOrderProjection[] {
  return rows.map((row) => toOrderProjection(row, cdn))
}
