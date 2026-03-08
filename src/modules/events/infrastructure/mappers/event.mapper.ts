import type { EventDetailProjection, EventListProjection } from '@events/application/projections'
import { Event } from '@events/domain/entities'
import type { EventStatusType } from '@events/domain/value-objects/event-status.vo'
import type { Prisma, Event as PrismaEvent } from '@generated/prisma/client'

type EventListSelect = {
  id: string
  name: string
  event_date: Date
  location: string | null
  province: { name: string } | null
  canton: { name: string } | null
  cover_image_url: string | null
  status: string
  total_photos: number
  processed_photos: number
}

type EventDetailSelect = EventListSelect & {
  cover_image_storage_key: string | null
  created_at: Date
  updated_at: Date
}

/** Converts a domain entity to a Prisma create input. */
export function toPersistence(entity: Event): Prisma.EventUncheckedCreateInput {
  return {
    id: entity.id,
    name: entity.name,
    event_date: entity.date,
    location: entity.location,
    province_id: entity.provinceId,
    canton_id: entity.cantonId,
    cover_image_url: entity.coverImageUrl,
    cover_image_storage_key: entity.coverImageStorageKey,
    status: entity.status,
    total_photos: entity.totalPhotos,
    processed_photos: entity.processedPhotos,
    created_at: entity.audit.createdAt,
    updated_at: entity.audit.updatedAt,
    deleted_at: entity.audit.deletedAt,
  }
}

/** Converts a Prisma record to a domain entity. */
export function toEntity(record: PrismaEvent): Event {
  return Event.fromPersistence({
    id: record.id,
    name: record.name,
    date: record.event_date,
    location: record.location,
    provinceId: record.province_id,
    cantonId: record.canton_id,
    coverImageUrl: record.cover_image_url,
    coverImageStorageKey: record.cover_image_storage_key,
    status: record.status as EventStatusType,
    totalPhotos: record.total_photos,
    processedPhotos: record.processed_photos,
    createdAt: record.created_at,
    updatedAt: record.updated_at,
    deletedAt: record.deleted_at,
  })
}

/** Converts a Prisma selected record to a list projection. */
export function toListProjection(record: EventListSelect): EventListProjection {
  return {
    id: record.id,
    name: record.name,
    date: record.event_date,
    location: record.location,
    provinceName: record.province?.name ?? null,
    cantonName: record.canton?.name ?? null,
    coverImageUrl: record.cover_image_url,
    coverImageSource: record.cover_image_url ? 'manual' : null,
    status: record.status,
    totalPhotos: record.total_photos,
    processedPhotos: record.processed_photos,
  }
}

/** Converts a Prisma record to a detail projection. */
export function toDetailProjection(record: EventDetailSelect): EventDetailProjection {
  return {
    id: record.id,
    name: record.name,
    date: record.event_date,
    location: record.location,
    provinceName: record.province?.name ?? null,
    cantonName: record.canton?.name ?? null,
    coverImageUrl: record.cover_image_url,
    coverImageSource: record.cover_image_url ? 'manual' : null,
    status: record.status,
    totalPhotos: record.total_photos,
    processedPhotos: record.processed_photos,
    createdAt: record.created_at,
    updatedAt: record.updated_at,
  }
}
