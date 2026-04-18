import { toDetectedParticipantProjection } from '@classifications/infrastructure/mappers/classification-projection.mapper'
import type { ClassificationDetailSelect } from '@classifications/infrastructure/mappers/cyclist.mapper'
import { classificationDetailSelectConfig } from '@classifications/infrastructure/mappers/cyclist.mapper'
import { Prisma, type Photo as PrismaPhoto } from '@generated/prisma/client'
import type {
  PhotoDetailProjection,
  PhotoListProjection,
  PhotoViewProjection,
} from '@photos/application/projections'
import { Photo } from '@photos/domain/entities'
import type { PhotoStatusType } from '@photos/domain/value-objects/photo-status.vo'
import type { UnclassifiedReasonType } from '@photos/domain/value-objects/unclassified-reason.vo'
import type { CdnUrlBuilder } from '@shared/cloudflare/infrastructure'

// --- Select shapes for Prisma queries ---

export const photoListSelectConfig = {
  id: true,
  filename: true,
  public_slug: true,
  status: true,
  uploaded_at: true,
  classified_at: true,
} satisfies Prisma.PhotoSelect

export type PhotoListSelect = Prisma.PhotoGetPayload<{ select: typeof photoListSelectConfig }>

export const photoDetailSelectConfig = {
  id: true,
  event_id: true,
  event: { select: { slug: true } },
  filename: true,
  public_slug: true,
  file_size: true,
  mime_type: true,
  width: true,
  height: true,
  status: true,
  unclassified_reason: true,
  retouched_file_size: true,
  retouched_at: true,
  captured_at: true,
  uploaded_at: true,
  processed_at: true,
  classified_at: true,
  ...classificationDetailSelectConfig,
} satisfies Prisma.PhotoSelect

export type PhotoDetailSelect = Prisma.PhotoGetPayload<{ select: typeof photoDetailSelectConfig }>

export const photoViewSelectConfig = {
  public_slug: true,
  event: { select: { slug: true } },
  filename: true,
  file_size: true,
  mime_type: true,
  status: true,
  unclassified_reason: true,
  uploaded_at: true,
  processed_at: true,
} satisfies Prisma.PhotoSelect

export type PhotoViewSelect = Prisma.PhotoGetPayload<{ select: typeof photoViewSelectConfig }>

// --- Entity mappers ---

/** Converts a domain entity to a Prisma unchecked create input. */
export function toPersistence(entity: Photo): Prisma.PhotoUncheckedCreateInput {
  return {
    id: entity.id,
    event_id: entity.eventId,
    filename: entity.filename,
    storage_key: entity.storageKey,
    public_slug: entity.publicSlug,
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
    publicSlug: record.public_slug,
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
export function toListProjection(record: PhotoListSelect, cdn: CdnUrlBuilder): PhotoListProjection {
  return {
    id: record.id,
    publicSlug: record.public_slug,
    filename: record.filename,
    thumbnailUrl: cdn.internalUrl(record.public_slug, 'thumb'),
    status: record.status,
    uploadedAt: record.uploaded_at,
    classifiedAt: record.classified_at,
  }
}

/** Converts a Prisma selected record to a detail projection with nested relations. */
export function toDetailProjection(
  record: PhotoDetailSelect,
  cdn: CdnUrlBuilder,
): PhotoDetailProjection {
  return {
    id: record.id,
    eventId: record.event_id,
    eventSlug: record.event.slug,
    filename: record.filename,
    publicSlug: record.public_slug,
    imageUrl: cdn.internalUrl(record.public_slug, 'workspace'),
    thumbnailUrl: cdn.internalUrl(record.public_slug, 'thumb'),
    fileSize: Number(record.file_size),
    mimeType: record.mime_type,
    width: record.width,
    height: record.height,
    status: record.status,
    unclassifiedReason: record.unclassified_reason,
    retouchedFileSize: record.retouched_file_size ? Number(record.retouched_file_size) : null,
    retouchedAt: record.retouched_at,
    capturedAt: record.captured_at,
    uploadedAt: record.uploaded_at,
    processedAt: record.processed_at,
    classifiedAt: record.classified_at,
    detectedParticipants: record.detected_participants.map(toDetectedParticipantProjection),
  }
}

/** Converts a Prisma record to a lightweight photo view projection. */
export function toViewProjection(record: PhotoViewSelect, cdn: CdnUrlBuilder): PhotoViewProjection {
  return {
    eventSlug: record.event.slug,
    filename: record.filename,
    imageUrl: cdn.internalUrl(record.public_slug, 'workspace'),
    fileSize: Number(record.file_size),
    mimeType: record.mime_type,
    status: record.status,
    unclassifiedReason: record.unclassified_reason,
    uploadedAt: record.uploaded_at,
    processedAt: record.processed_at,
  }
}
