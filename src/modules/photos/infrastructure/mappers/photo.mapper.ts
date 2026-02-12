import type { Prisma, Photo as PrismaPhoto } from '@generated/prisma/client'
import { Photo } from '@photos/domain/entities'
import type { PhotoStatusType } from '@photos/domain/value-objects/photo-status.vo'
import type { UnclassifiedReasonType } from '@photos/domain/value-objects/unclassified-reason.vo'

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
