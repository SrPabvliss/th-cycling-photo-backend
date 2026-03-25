import type { EventDetailProjection, EventListProjection } from '@events/application/projections'
import { Event } from '@events/domain/entities'
import type { EventStatusType } from '@events/domain/value-objects/event-status.vo'
import type { Prisma, Event as PrismaEvent } from '@generated/prisma/client'

type EventListSelect = {
  id: string
  name: string
  description: string | null
  event_date: Date
  location: string | null
  province: { name: string } | null
  canton: { name: string } | null
  cover_image_url: string | null
  status: string
  _count: { photos: number }
}

type EventDetailSelect = EventListSelect & {
  province_id: number | null
  canton_id: number | null
  cover_image_storage_key: string | null
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
    cover_image_url: entity.coverImageUrl,
    cover_image_storage_key: entity.coverImageStorageKey,
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
    coverImageUrl: record.cover_image_url,
    coverImageStorageKey: record.cover_image_storage_key,
    status: record.status as EventStatusType,
    createdAt: record.created_at,
    updatedAt: record.updated_at,
    deletedAt: record.deleted_at,
    createdById: record.created_by_id,
    updatedById: record.updated_by_id,
  })
}

/** Converts a Prisma selected record to a list projection. */
export function toListProjection(record: EventListSelect): EventListProjection {
  return {
    id: record.id,
    name: record.name,
    description: record.description,
    date: record.event_date,
    location: record.location,
    provinceName: record.province?.name ?? null,
    cantonName: record.canton?.name ?? null,
    coverImageUrl: record.cover_image_url,
    coverImageSource: record.cover_image_url ? 'manual' : null,
    status: record.status,
    photoCount: record._count.photos,
    classifiedCount: 0,
    totalFileSize: 0,
  }
}

/** Converts a Prisma record to a detail projection. */
export function toDetailProjection(record: EventDetailSelect): EventDetailProjection {
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
    coverImageUrl: record.cover_image_url,
    coverImageSource: record.cover_image_url ? 'manual' : null,
    status: record.status,
    photoCount: record._count.photos,
    classifiedCount: 0,
    totalFileSize: 0,
    createdAt: record.created_at,
    updatedAt: record.updated_at,
  }
}
