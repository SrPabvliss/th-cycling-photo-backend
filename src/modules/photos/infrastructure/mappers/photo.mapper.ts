import { toDetectedParticipantProjection } from '@classifications/infrastructure/mappers/classification-projection.mapper'
import type { ClassificationDetailSelect } from '@classifications/infrastructure/mappers/cyclist.mapper'
import { classificationDetailSelectConfig } from '@classifications/infrastructure/mappers/cyclist.mapper'
import { Prisma, type Photo as PrismaPhoto } from '@generated/prisma/client'
import type { PhotoDetailProjection, PhotoListProjection } from '@photos/application/projections'
import { Photo } from '@photos/domain/entities'
import type { PhotoStatusType } from '@photos/domain/value-objects/photo-status.vo'
import type { UnclassifiedReasonType } from '@photos/domain/value-objects/unclassified-reason.vo'

// --- Select shapes for Prisma queries ---

export const photoListSelectConfig = {
  id: true,
  event_id: true,
  filename: true,
  storage_key: true,
  status: true,
  width: true,
  height: true,
  uploaded_at: true,
  classified_at: true,
} satisfies Prisma.PhotoSelect

export type PhotoListSelect = Prisma.PhotoGetPayload<{ select: typeof photoListSelectConfig }>

export const photoDetailSelectConfig = {
  id: true,
  event_id: true,
  filename: true,
  storage_key: true,
  file_size: true,
  mime_type: true,
  width: true,
  height: true,
  status: true,
  unclassified_reason: true,
  retouched_storage_key: true,
  retouched_file_size: true,
  retouched_at: true,
  captured_at: true,
  uploaded_at: true,
  processed_at: true,
  classified_at: true,
  ...classificationDetailSelectConfig,
} satisfies Prisma.PhotoSelect

export type PhotoDetailSelect = Prisma.PhotoGetPayload<{ select: typeof photoDetailSelectConfig }>

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
    retouched_storage_key: entity.retouchedStorageKey,
    retouched_file_size: entity.retouchedFileSize,
    retouched_at: entity.retouchedAt,
    retouched_by_id: entity.retouchedById,
    captured_at: entity.capturedAt,
    uploaded_at: entity.uploadedAt,
    processed_at: entity.processedAt,
    created_by_id: entity.createdById,
    photo_category_id: entity.photoCategoryId,
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
    retouchedStorageKey: record.retouched_storage_key,
    retouchedFileSize: record.retouched_file_size,
    retouchedAt: record.retouched_at,
    retouchedById: record.retouched_by_id,
    photoCategoryId: record.photo_category_id,
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
    classifiedAt: record.classified_at,
  }
}

/** Converts a Prisma selected record to a detail projection with nested relations. */
export function toDetailProjection(record: PhotoDetailSelect): PhotoDetailProjection {
  return {
    id: record.id,
    eventId: record.event_id,
    filename: record.filename,
    storageKey: record.storage_key,
    fileSize: Number(record.file_size),
    mimeType: record.mime_type,
    width: record.width,
    height: record.height,
    status: record.status,
    unclassifiedReason: record.unclassified_reason,
    retouchedStorageKey: record.retouched_storage_key,
    retouchedFileSize: record.retouched_file_size ? Number(record.retouched_file_size) : null,
    retouchedAt: record.retouched_at,
    capturedAt: record.captured_at,
    uploadedAt: record.uploaded_at,
    processedAt: record.processed_at,
    classifiedAt: record.classified_at,
    detectedParticipants: record.detected_participants.map(toDetectedParticipantProjection),
  }
}
