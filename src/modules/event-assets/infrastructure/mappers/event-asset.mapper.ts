import { Prisma, type EventAsset as PrismaEventAsset } from '@generated/prisma/client'
import type { EventAssetProjection } from '../../application/projections'
import { EventAsset } from '../../domain/entities'

export const eventAssetSelectConfig = {
  id: true,
  event_id: true,
  asset_type: true,
  storage_key: true,
  public_slug: true,
  file_size: true,
  mime_type: true,
  uploaded_at: true,
} satisfies Prisma.EventAssetSelect

export type EventAssetSelect = Prisma.EventAssetGetPayload<{
  select: typeof eventAssetSelectConfig
}>

export function toPersistence(entity: EventAsset): Prisma.EventAssetUncheckedCreateInput {
  return {
    id: entity.id,
    event_id: entity.eventId,
    asset_type: entity.assetType,
    storage_key: entity.storageKey,
    public_slug: entity.publicSlug,
    file_size: entity.fileSize,
    mime_type: entity.mimeType,
    uploaded_at: entity.uploadedAt,
  }
}

export function toEntity(record: PrismaEventAsset): EventAsset {
  return EventAsset.fromPersistence({
    id: record.id,
    eventId: record.event_id,
    assetType: record.asset_type,
    storageKey: record.storage_key,
    publicSlug: record.public_slug,
    fileSize: record.file_size,
    mimeType: record.mime_type,
    uploadedAt: record.uploaded_at,
  })
}

export function toProjection(record: EventAssetSelect, url: string): EventAssetProjection {
  return {
    id: record.id,
    assetType: record.asset_type,
    url,
    fileSize: record.file_size ? Number(record.file_size) : null,
    mimeType: record.mime_type,
    uploadedAt: record.uploaded_at,
  }
}
