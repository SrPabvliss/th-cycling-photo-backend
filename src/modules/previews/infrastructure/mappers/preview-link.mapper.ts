import type { Prisma, PreviewLink as PrismaPreviewLink } from '@generated/prisma/client'
import type { PreviewLinkListProjection } from '@previews/application/projections'
import { PreviewLink } from '@previews/domain/entities'
import type { PreviewLinkStatusType } from '@previews/domain/value-objects/preview-link-status.vo'

type PreviewLinkListSelect = {
  id: string
  token: string
  status: string
  expires_at: Date
  viewed_at: Date | null
  created_at: Date
  _count: { photos: number; orders: number }
}

/** Converts a domain entity to a Prisma create input. */
export function toPersistence(entity: PreviewLink): Prisma.PreviewLinkUncheckedCreateInput {
  return {
    id: entity.id,
    token: entity.token,
    event_id: entity.eventId,
    status: entity.status,
    expires_at: entity.expiresAt,
    viewed_at: entity.viewedAt,
    created_at: entity.createdAt,
    created_by_id: entity.createdById,
  }
}

/** Converts a Prisma record to a domain entity. */
export function toEntity(record: PrismaPreviewLink): PreviewLink {
  return PreviewLink.fromPersistence({
    id: record.id,
    token: record.token,
    eventId: record.event_id,
    status: record.status as PreviewLinkStatusType,
    expiresAt: record.expires_at,
    viewedAt: record.viewed_at,
    createdAt: record.created_at,
    createdById: record.created_by_id,
  })
}

/** Converts a Prisma selected record to a list projection. */
export function toListProjection(record: PreviewLinkListSelect): PreviewLinkListProjection {
  return {
    id: record.id,
    token: record.token,
    status: record.status,
    expiresAt: record.expires_at,
    viewedAt: record.viewed_at,
    createdAt: record.created_at,
    photoCount: record._count.photos,
    orderCount: record._count.orders,
  }
}
