import type { CdnUrlBuilder } from '@shared/cloudflare/infrastructure'
import type {
  RetouchQueueItemProjection,
  RetouchQueueOrderProjection,
  RetouchQueueProjection,
} from '../../application/projections'

interface OrderRecord {
  id: string
  snap_first_name: string | null
  snap_last_name: string | null
  created_at: Date
  items: { photo: PhotoRecord }[]
}

interface PhotoRecord {
  id: string
  public_slug: string
  retouched_storage_key: string | null
}

function toItemProjection(photo: PhotoRecord, cdn: CdnUrlBuilder): RetouchQueueItemProjection {
  return {
    photoId: photo.id,
    thumbnailUrl: cdn.internalUrl(photo.public_slug, 'thumb'),
    isRetouched: photo.retouched_storage_key !== null,
  }
}

function toOrderProjection(order: OrderRecord, cdn: CdnUrlBuilder): RetouchQueueOrderProjection {
  const items = order.items.map((item) => toItemProjection(item.photo, cdn))
  return {
    orderId: order.id,
    buyerName: [order.snap_first_name, order.snap_last_name].filter(Boolean).join(' '),
    createdAt: order.created_at.toISOString(),
    totalItems: items.length,
    retouchedItems: items.filter((item) => item.isRetouched).length,
    items,
  }
}

export function toRetouchQueueProjection(
  orders: OrderRecord[],
  cdn: CdnUrlBuilder,
): RetouchQueueProjection {
  return {
    orders: orders.map((o) => toOrderProjection(o, cdn)),
  }
}
