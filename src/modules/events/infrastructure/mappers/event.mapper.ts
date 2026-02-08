import type { EventDetailProjection, EventListProjection } from '@events/application/projections'
import { Event } from '@events/domain/entities'
import type { EventStatusType } from '@events/domain/value-objects/event-status.vo'
import type { Prisma, Event as PrismaEvent } from '@generated/prisma/client'

type EventListSelect = {
  id: string
  name: string
  event_date: Date
  location: string | null
  status: string
  total_photos: number
  processed_photos: number
}

type EventDetailSelect = EventListSelect & {
  created_at: Date
  updated_at: Date
}

/** Converts a domain entity to a Prisma create input. */
export function toPersistence(entity: Event): Prisma.EventCreateInput {
  return {
    id: entity.id,
    name: entity.name,
    event_date: entity.date,
    location: entity.location,
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
    status: record.status,
    totalPhotos: record.total_photos,
    processedPhotos: record.processed_photos,
    createdAt: record.created_at,
    updatedAt: record.updated_at,
  }
}
