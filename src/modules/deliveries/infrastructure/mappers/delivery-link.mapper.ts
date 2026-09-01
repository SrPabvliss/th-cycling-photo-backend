import { DeliveryLink } from '@deliveries/domain/entities'
import type { DeliveryLinkStatusType } from '@deliveries/domain/value-objects/delivery-link-status.vo'
import type { Prisma, DeliveryLink as PrismaDeliveryLink } from '@generated/prisma/client'

/** Converts a domain entity to a Prisma create input. */
export function toPersistence(entity: DeliveryLink): Prisma.DeliveryLinkUncheckedCreateInput {
  return {
    id: entity.id,
    order_id: entity.orderId,
    token: entity.token,
    status: entity.status,
    expires_at: entity.expiresAt,
    first_downloaded_at: entity.firstDownloadedAt,
    download_count: entity.downloadCount,
    created_at: entity.createdAt,
  }
}

/**
 * The columns a regenerated link overwrites on the order's existing row. `id` and `order_id` stay
 * as they are: the row is replaced in place, not inserted again.
 */
export function toReplacement(entity: DeliveryLink): Prisma.DeliveryLinkUncheckedUpdateInput {
  return {
    token: entity.token,
    status: entity.status,
    expires_at: entity.expiresAt,
    first_downloaded_at: null,
    last_downloaded_at: null,
    download_count: 0,
    created_at: entity.createdAt,
  }
}

/** Converts a Prisma record to a domain entity. */
export function toEntity(record: PrismaDeliveryLink): DeliveryLink {
  return DeliveryLink.fromPersistence({
    id: record.id,
    orderId: record.order_id,
    token: record.token,
    status: record.status as DeliveryLinkStatusType,
    expiresAt: record.expires_at,
    firstDownloadedAt: record.first_downloaded_at,
    downloadCount: record.download_count,
    createdAt: record.created_at,
  })
}
