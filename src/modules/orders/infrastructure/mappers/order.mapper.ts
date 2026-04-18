import type { Prisma, Order as PrismaOrder } from '@generated/prisma/client'
import type { RetouchCompletedOrderProjection } from '@orders/application/projections'
import { Order } from '@orders/domain/entities'
import type { OrderStatusType } from '@orders/domain/value-objects/order-status.vo'

/** Converts a domain entity to a Prisma create input. */
export function toPersistence(entity: Order): Prisma.OrderUncheckedCreateInput {
  return {
    id: entity.id,
    preview_link_id: entity.previewLinkId,
    event_id: entity.eventId,
    user_id: entity.userId,
    status: entity.status,
    notes: entity.notes,
    bib_number: entity.bibNumber,
    subtotal: entity.subtotal,
    created_at: entity.createdAt,
    paid_at: entity.paidAt,
    delivered_at: entity.deliveredAt,
    cancelled_at: entity.cancelledAt,
    confirmed_by_id: entity.confirmedById,
  }
}

/** Converts a Prisma record to a domain entity. */
export function toEntity(record: PrismaOrder): Order {
  return Order.fromPersistence({
    id: record.id,
    previewLinkId: record.preview_link_id,
    eventId: record.event_id,
    userId: record.user_id,
    status: record.status as OrderStatusType,
    notes: record.notes,
    bibNumber: record.bib_number,
    subtotal: record.subtotal ? Number(record.subtotal) : null,
    createdAt: record.created_at,
    paidAt: record.paid_at,
    deliveredAt: record.delivered_at,
    cancelledAt: record.cancelled_at,
    confirmedById: record.confirmed_by_id,
  })
}

/** Maps a Prisma order record to a retouch-completed projection. */
export function toRetouchCompletedProjection(record: {
  id: string
  event_id: string
  event: { name: string }
  snap_first_name: string | null
  snap_last_name: string | null
  _count: { items: number }
}): RetouchCompletedOrderProjection {
  return {
    orderId: record.id,
    eventId: record.event_id,
    eventName: record.event.name,
    customerName: [record.snap_first_name, record.snap_last_name].filter(Boolean).join(' '),
    photoCount: record._count.items,
  }
}
