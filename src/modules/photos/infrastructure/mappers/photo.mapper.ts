import { CorrectionTargetType, Prisma, type Photo as PrismaPhoto } from '@generated/prisma/client'
import type {
  PhotoDetailProjection,
  PhotoListProjection,
  PhotoViewProjection,
} from '@photos/application/projections'
import { Photo } from '@photos/domain/entities'
import type { ICorrectionRepository } from '@photos/domain/ports'
import type { PhotoStatusType } from '@photos/domain/value-objects/photo-status.vo'
import type { CdnUrlBuilder } from '@shared/cloudflare/infrastructure'
import type { IStorageAdapter } from '@shared/storage/domain/ports/storage-adapter.port'

// --- Select shapes for Prisma queries ---

export const photoListSelectConfig = {
  id: true,
  filename: true,
  public_slug: true,
  status: true,
  uploaded_at: true,
  reviewed_at: true,
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
  retouched_public_slug: true,
  retouched_file_size: true,
  retouched_at: true,
  captured_at: true,
  uploaded_at: true,
  processed_at: true,
  reviewed_at: true,
  bibs: {
    select: {
      id: true,
      source: true,
      digits: true,
      status: true,
      confidence: true,
      crop_path: true,
    },
    orderBy: { created_at: 'asc' as const },
  },
  colors: {
    select: {
      id: true,
      source: true,
      region: true,
      primary_color: true,
      secondary_color: true,
      confidence: true,
      crop_path: true,
    },
    orderBy: { created_at: 'asc' as const },
  },
} satisfies Prisma.PhotoSelect

export type PhotoDetailSelect = Prisma.PhotoGetPayload<{ select: typeof photoDetailSelectConfig }>

export const photoViewSelectConfig = {
  public_slug: true,
  event: { select: { slug: true } },
  filename: true,
  file_size: true,
  mime_type: true,
  status: true,
  uploaded_at: true,
  processed_at: true,
  reviewed_at: true,
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
    retouched_storage_key: entity.retouchedStorageKey,
    retouched_public_slug: entity.retouchedPublicSlug,
    retouched_file_size: entity.retouchedFileSize,
    retouched_at: entity.retouchedAt,
    retouched_by_id: entity.retouchedById,
    captured_at: entity.capturedAt,
    uploaded_at: entity.uploadedAt,
    processed_at: entity.processedAt,
    reviewed_at: entity.reviewedAt,
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
    capturedAt: record.captured_at,
    uploadedAt: record.uploaded_at,
    processedAt: record.processed_at,
    reviewedAt: record.reviewed_at,
    retouchedStorageKey: record.retouched_storage_key,
    retouchedPublicSlug: record.retouched_public_slug,
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
    reviewedAt: record.reviewed_at,
  }
}

/** Converts a Prisma selected record to a detail projection. Signs each crop_path via storage. */
export async function toDetailProjection(
  record: PhotoDetailSelect,
  cdn: CdnUrlBuilder,
  storage: IStorageAdapter,
  correctionRepo: ICorrectionRepository,
): Promise<PhotoDetailProjection> {
  const cropPaths = Array.from(
    new Set(
      [...record.bibs.map((b) => b.crop_path), ...record.colors.map((c) => c.crop_path)].filter(
        (p): p is string => p !== null,
      ),
    ),
  )

  const settled = await Promise.allSettled(
    cropPaths.map(async (path) => {
      const url = await storage.getPresignedDownloadUrl({ key: path, expiresIn: 3600 })
      return [path, url] as const
    }),
  )

  const signedByPath = new Map<string, string>(
    settled.flatMap((r) => (r.status === 'fulfilled' ? [r.value] : [])),
  )

  const correctionTargets = [
    ...record.bibs.map((b) => ({
      targetType: CorrectionTargetType.photo_bib,
      targetId: b.id,
    })),
    ...record.colors.map((c) => ({
      targetType: CorrectionTargetType.photo_color,
      targetId: c.id,
    })),
  ]
  const corrections = await correctionRepo.findLatestByTargets(correctionTargets)

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
    retouchedImageUrl: record.retouched_public_slug
      ? cdn.internalUrl(record.retouched_public_slug, 'workspace')
      : null,
    retouchedFileSize: record.retouched_file_size ? Number(record.retouched_file_size) : null,
    retouchedAt: record.retouched_at,
    capturedAt: record.captured_at,
    uploadedAt: record.uploaded_at,
    processedAt: record.processed_at,
    reviewedAt: record.reviewed_at,
    bibs: record.bibs.map((b) => {
      const c = corrections.get(`photo_bib:${b.id}:digits`)
      return {
        id: b.id,
        digits: c?.newValue ?? b.digits,
        digitsOriginal: b.digits,
        wasCorrected: !!c,
        correctedAt: c?.correctedAt ?? null,
        status: b.status,
        confidence: b.confidence === null ? null : Number(b.confidence),
        source: b.source,
        cropUrl: b.crop_path ? (signedByPath.get(b.crop_path) ?? null) : null,
      }
    }),
    colors: record.colors.map((c) => {
      const cp = corrections.get(`photo_color:${c.id}:primary_color`)
      const cs = corrections.get(`photo_color:${c.id}:secondary_color`)
      return {
        id: c.id,
        region: c.region,
        primaryColor: (cp?.newValue ?? c.primary_color) as string,
        primaryColorOriginal: c.primary_color,
        primaryWasCorrected: !!cp,
        secondaryColor: cs?.newValue ?? c.secondary_color,
        secondaryColorOriginal: c.secondary_color,
        secondaryWasCorrected: !!cs,
        confidence: c.confidence === null ? null : Number(c.confidence),
        source: c.source,
        cropUrl: c.crop_path ? (signedByPath.get(c.crop_path) ?? null) : null,
      }
    }),
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
    uploadedAt: record.uploaded_at,
    processedAt: record.processed_at,
    reviewedAt: record.reviewed_at,
  }
}
