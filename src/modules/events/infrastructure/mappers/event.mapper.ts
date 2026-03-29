import type { EventDetailProjection, EventListProjection } from '@events/application/projections'
import { Event } from '@events/domain/entities'
import type { EventStatusType } from '@events/domain/value-objects/event-status.vo'
import type { Prisma, Event as PrismaEvent } from '@generated/prisma/client'

type EventAssetSelect = {
  storage_key: string
}

type EventListSelect = {
  id: string
  name: string
  description: string | null
  event_date: Date
  location: string | null
  province: { name: string } | null
  canton: { name: string } | null
  is_featured: boolean
  status: string
  _count: { photos: number }
  assets: EventAssetSelect[]
}

type EventDetailSelect = EventListSelect & {
  province_id: number | null
  canton_id: number | null
  created_at: Date
  updated_at: Date
}

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
    status: record.status as EventStatusType,
    createdAt: record.created_at,
    updatedAt: record.updated_at,
    deletedAt: record.deleted_at,
    createdById: record.created_by_id,
    updatedById: record.updated_by_id,
  })
}

/** Extracts cover image URL from joined EventAsset (asset_type = cover_image). */
function getCoverImageUrl(
  assets: EventAssetSelect[],
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
