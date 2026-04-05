import type {
  EventDetailProjection,
  EventListProjection,
  PublicEventDetailProjection,
  PublicEventListProjection,
} from '@events/application/projections'
import { Event } from '@events/domain/entities'
import type { EventStatusType } from '@events/domain/value-objects/event-status.vo'
import { Prisma, type Event as PrismaEvent } from '@generated/prisma/client'

// --- Select shapes for Prisma queries ---

export const coverImageAssetSelectConfig = {
  storage_key: true,
} satisfies Prisma.EventAssetSelect

export const eventListSelectConfig = {
  id: true,
  name: true,
  description: true,
  event_date: true,
  location: true,
  province: { select: { name: true } },
  canton: { select: { name: true } },
  is_featured: true,
  status: true,
  _count: { select: { photos: true } },
  assets: {
    select: coverImageAssetSelectConfig,
    where: { asset_type: 'cover_image' },
    take: 1,
  },
} satisfies Prisma.EventSelect

export type EventListSelect = Prisma.EventGetPayload<{ select: typeof eventListSelectConfig }>

export const eventDetailSelectConfig = {
  ...eventListSelectConfig,
  province_id: true,
  canton_id: true,
  created_at: true,
  updated_at: true,
} satisfies Prisma.EventSelect

export type EventDetailSelect = Prisma.EventGetPayload<{ select: typeof eventDetailSelectConfig }>

export const publicEventListSelectConfig = {
  id: true,
  name: true,
  event_date: true,
  location: true,
  province: { select: { name: true } },
  canton: { select: { name: true } },
  is_featured: true,
  _count: { select: { photos: true } },
  assets: { select: { asset_type: true, storage_key: true } },
} satisfies Prisma.EventSelect

export type PublicEventListSelect = Prisma.EventGetPayload<{
  select: typeof publicEventListSelectConfig
}>

export const publicEventDetailSelectConfig = {
  id: true,
  name: true,
  description: true,
  event_date: true,
  location: true,
  province: { select: { name: true } },
  canton: { select: { name: true } },
  is_featured: true,
  _count: { select: { photos: true } },
  assets: { select: { asset_type: true, storage_key: true } },
  photo_categories: {
    select: { photo_category: { select: { id: true, name: true } } },
    orderBy: { photo_category: { name: 'asc' } },
  },
} satisfies Prisma.EventSelect

export type PublicEventDetailSelect = Prisma.EventGetPayload<{
  select: typeof publicEventDetailSelectConfig
}>

// --- Entity mappers ---

/** Converts a domain entity to a Prisma create input. */
export function toPersistence(entity: Event): Prisma.EventUncheckedCreateInput {
  return {
    id: entity.id,
    name: entity.name,
    description: entity.description,
    event_date: entity.date,
    location: entity.location,
    province_id: entity.provinceId,
    canton_id: entity.cantonId,
    event_type_id: entity.eventTypeId,
    status: entity.status,
    created_at: entity.audit.createdAt,
    updated_at: entity.audit.updatedAt,
    deleted_at: entity.audit.deletedAt,
    created_by_id: entity.audit.createdById,
    updated_by_id: entity.audit.updatedById,
  }
}

/** Converts a Prisma record to a domain entity. */
export function toEntity(record: PrismaEvent): Event {
  return Event.fromPersistence({
    id: record.id,
    name: record.name,
    description: record.description,
    date: record.event_date,
    location: record.location,
    provinceId: record.province_id,
    cantonId: record.canton_id,
    eventTypeId: record.event_type_id,
    status: record.status as EventStatusType,
    createdAt: record.created_at,
    updatedAt: record.updated_at,
    deletedAt: record.deleted_at,
    createdById: record.created_by_id,
    updatedById: record.updated_by_id,
  })
}

// --- Projection mappers ---

/** Extracts cover image URL from joined EventAsset (asset_type = cover_image). */
function getCoverImageUrl(
  assets: { storage_key: string }[],
  getPublicUrl?: (key: string) => string,
): string | null {
  const cover = assets[0]
  if (!cover) return null
  return getPublicUrl ? getPublicUrl(cover.storage_key) : null
}

/** Converts a Prisma selected record to a list projection. */
export function toListProjection(
  record: EventListSelect,
  getPublicUrl?: (key: string) => string,
): EventListProjection {
  const coverUrl = getCoverImageUrl(record.assets, getPublicUrl)
  return {
    id: record.id,
    name: record.name,
    description: record.description,
    date: record.event_date,
    location: record.location,
    provinceName: record.province?.name ?? null,
    cantonName: record.canton?.name ?? null,
    coverImageUrl: coverUrl,
    coverImageSource: coverUrl ? 'manual' : null,
    isFeatured: record.is_featured,
    status: record.status,
    photoCount: record._count.photos,
    classifiedCount: 0,
    totalFileSize: 0,
  }
}

/** Converts a Prisma record to a detail projection. */
export function toDetailProjection(
  record: EventDetailSelect,
  getPublicUrl?: (key: string) => string,
): EventDetailProjection {
  const coverUrl = getCoverImageUrl(record.assets, getPublicUrl)
  return {
    id: record.id,
    name: record.name,
    description: record.description,
    date: record.event_date,
    location: record.location,
    provinceName: record.province?.name ?? null,
    cantonName: record.canton?.name ?? null,
    provinceId: record.province_id,
    cantonId: record.canton_id,
    coverImageUrl: coverUrl,
    coverImageSource: coverUrl ? 'manual' : null,
    isFeatured: record.is_featured,
    status: record.status,
    photoCount: record._count.photos,
    classifiedCount: 0,
    totalFileSize: 0,
    createdAt: record.created_at,
    updatedAt: record.updated_at,
  }
}

/** Converts a Prisma record to a public list projection. */
export function toPublicListProjection(
  record: PublicEventListSelect,
  getPublicUrl: (key: string) => string,
): PublicEventListProjection {
  return {
    id: record.id,
    name: record.name,
    date: record.event_date,
    location: record.location,
    provinceName: record.province?.name ?? null,
    cantonName: record.canton?.name ?? null,
    isFeatured: record.is_featured,
    photoCount: record._count.photos,
    assets: record.assets.map((a) => ({
      assetType: a.asset_type,
      url: getPublicUrl(a.storage_key),
    })),
  }
}

/** Converts a Prisma record to a public detail projection. */
export function toPublicDetailProjection(
  record: PublicEventDetailSelect,
  getPublicUrl: (key: string) => string,
): PublicEventDetailProjection {
  return {
    id: record.id,
    name: record.name,
    description: record.description,
    date: record.event_date,
    location: record.location,
    provinceName: record.province?.name ?? null,
    cantonName: record.canton?.name ?? null,
    isFeatured: record.is_featured,
    photoCount: record._count.photos,
    assets: record.assets.map((a) => ({
      assetType: a.asset_type,
      url: getPublicUrl(a.storage_key),
    })),
    photoCategories: record.photo_categories.map((c) => ({
      id: c.photo_category.id,
      name: c.photo_category.name,
    })),
  }
}
