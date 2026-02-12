import type { ClassificationDetailSelect } from '@classifications/infrastructure/constants'
import { toDetectedCyclistProjection } from '@classifications/infrastructure/mappers/classification-projection.mapper'
import type { Prisma, Photo as PrismaPhoto } from '@generated/prisma/client'
import type { PhotoDetailProjection, PhotoListProjection } from '@photos/application/projections'
import { Photo } from '@photos/domain/entities'
import type { PhotoStatusType } from '@photos/domain/value-objects/photo-status.vo'
import type { UnclassifiedReasonType } from '@photos/domain/value-objects/unclassified-reason.vo'

// --- Select shapes for Prisma queries ---

export type PhotoListSelect = {
  id: string
  event_id: string
  filename: string
  storage_key: string
  status: string
  width: number | null
  height: number | null
  uploaded_at: Date
}

export type PhotoDetailSelect = {
  id: string
  event_id: string
  filename: string
  storage_key: string
  file_size: bigint
  mime_type: string
  width: number | null
  height: number | null
  status: string
  unclassified_reason: string | null
  captured_at: Date | null
  uploaded_at: Date
  processed_at: Date | null
  detected_cyclists: ClassificationDetailSelect[]
}

// --- Entity mappers ---

/** Converts a domain entity to a Prisma unchecked create input. */
export function toPersistence(entity: Photo): Prisma.PhotoUncheckedCreateInput {
  return {
    id: entity.id,
    event_id: entity.eventId,
    filename: entity.filename,
    storage_key: entity.storageKey,
    file_size: entity.fileSize,
    mime_type: entity.mimeType,
    width: entity.width,
    height: entity.height,
    status: entity.status,
    unclassified_reason: entity.unclassifiedReason,
    captured_at: entity.capturedAt,
    uploaded_at: entity.uploadedAt,
    processed_at: entity.processedAt,
  }
}

/** Converts a Prisma record to a domain entity. */
export function toEntity(record: PrismaPhoto): Photo {
  return Photo.fromPersistence({
    id: record.id,
    eventId: record.event_id,
    filename: record.filename,
    storageKey: record.storage_key,
    fileSize: record.file_size,
    mimeType: record.mime_type,
    width: record.width,
    height: record.height,
    status: record.status as PhotoStatusType,
    unclassifiedReason: record.unclassified_reason as UnclassifiedReasonType | null,
    capturedAt: record.captured_at,
    uploadedAt: record.uploaded_at,
    processedAt: record.processed_at,
  })
}

// --- Projection mappers ---

/** Converts a Prisma selected record to a list projection. */
export function toListProjection(record: PhotoListSelect): PhotoListProjection {
  return {
    id: record.id,
    eventId: record.event_id,
    filename: record.filename,
    storageKey: record.storage_key,
    status: record.status,
    width: record.width,
    height: record.height,
    uploadedAt: record.uploaded_at,
  }
}

/** Converts a Prisma selected record to a detail projection with nested relations. */
export function toDetailProjection(record: PhotoDetailSelect): PhotoDetailProjection {
  return {
    id: record.id,
    eventId: record.event_id,
    filename: record.filename,
    storageKey: record.storage_key,
    fileSize: record.file_size,
    mimeType: record.mime_type,
    width: record.width,
    height: record.height,
    status: record.status,
    unclassifiedReason: record.unclassified_reason,
    capturedAt: record.captured_at,
    uploadedAt: record.uploaded_at,
    processedAt: record.processed_at,
    detectedCyclists: record.detected_cyclists.map(toDetectedCyclistProjection),
  }
}
