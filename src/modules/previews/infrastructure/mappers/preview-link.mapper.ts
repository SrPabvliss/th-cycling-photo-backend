import { Prisma, type PreviewLink as PrismaPreviewLink } from '@generated/prisma/client'
import type {
  PreviewDataProjection,
  PreviewLinkListProjection,
} from '@previews/application/projections'
import { PreviewLink } from '@previews/domain/entities'
import type { PreviewLinkStatusType } from '@previews/domain/value-objects/preview-link-status.vo'

export const previewLinkListSelectConfig = {
  id: true,
  token: true,
  status: true,
  expires_at: true,
  viewed_at: true,
  created_at: true,
  _count: { select: { photos: true, orders: true } },
} satisfies Prisma.PreviewLinkSelect

export type PreviewLinkListSelect = Prisma.PreviewLinkGetPayload<{
  select: typeof previewLinkListSelectConfig
}>

export const previewDataSelectConfig = {
  token: true,
  status: true,
  expires_at: true,
  event: { select: { name: true, event_date: true } },
  photos: {
    select: {
      photo: { select: { id: true, storage_key: true } },
    },
  },
} satisfies Prisma.PreviewLinkSelect

export type PreviewDataSelect = Prisma.PreviewLinkGetPayload<{
  select: typeof previewDataSelectConfig
}>

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

/** Converts a Prisma selected record to a public preview data projection. */
export function toPreviewDataProjection(record: PreviewDataSelect): PreviewDataProjection {
  return {
    token: record.token,
    eventName: record.event.name,
    eventDate: record.event.event_date,
    status: record.status,
    expiresAt: record.expires_at,
    photos: record.photos.map((plp) => ({
      id: plp.photo.id,
      url: plp.photo.storage_key,
    })),
  }
}
