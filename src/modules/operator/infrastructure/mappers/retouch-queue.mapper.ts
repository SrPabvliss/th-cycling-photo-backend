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
  storage_key: string
  retouched_storage_key: string | null
}

function toItemProjection(photo: PhotoRecord): RetouchQueueItemProjection {
  return {
    photoId: photo.id,
    storageKey: photo.storage_key,
    isRetouched: photo.retouched_storage_key !== null,
    retouchedStorageKey: photo.retouched_storage_key,
  }
}

function toOrderProjection(order: OrderRecord): RetouchQueueOrderProjection {
  const items = order.items.map((item) => toItemProjection(item.photo))
  return {
    orderId: order.id,
    buyerName: [order.snap_first_name, order.snap_last_name].filter(Boolean).join(' '),
    createdAt: order.created_at.toISOString(),
    totalItems: items.length,
    retouchedItems: items.filter((item) => item.isRetouched).length,
    items,
  }
}

export function toRetouchQueueProjection(orders: OrderRecord[]): RetouchQueueProjection {
  return {
    orders: orders.map(toOrderProjection),
  }
}
