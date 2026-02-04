import type {
  EventCreateInput,
  Event as PrismaEvent,
} from '../../../../../generated/prisma/client.js'
import type { EventDetailProjection } from '../../application/projections/event-detail.projection.js'
import type { EventListProjection } from '../../application/projections/event-list.projection.js'
import { Event } from '../../domain/entities/event.entity.js'
import type { EventStatusType } from '../../domain/value-objects/event-status.vo.js'

export class EventMapper {
  /** Converts a domain entity to a Prisma create input. */
  static toPersistence(entity: Event): EventCreateInput {
    return {
      id: entity.id,
      name: entity.name,
      event_date: entity.date,
      location: entity.location,
      status: entity.status,
      total_photos: entity.totalPhotos,
      processed_photos: entity.processedPhotos,
      created_at: entity.createdAt,
      updated_at: entity.updatedAt,
    }
  }

  /** Converts a Prisma record to a domain entity. */
  static toEntity(record: PrismaEvent): Event {
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
    })
  }

  /** Converts a Prisma selected record to a list projection. */
  static toListProjection(record: {
    id: string
    name: string
    event_date: Date
    location: string | null
    status: string
    total_photos: number
    processed_photos: number
  }): EventListProjection {
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
  static toDetailProjection(record: {
    id: string
    name: string
    event_date: Date
    location: string | null
    status: string
    total_photos: number
    processed_photos: number
    created_at: Date
    updated_at: Date
  }): EventDetailProjection {
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
}
