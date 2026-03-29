import type {
  EventAssetType,
  Prisma,
  EventAsset as PrismaEventAsset,
} from '@generated/prisma/client'
import type { EventAssetProjection } from '../../application/projections'
import { EventAsset } from '../../domain/entities'

type EventAssetSelect = {
  id: string
  event_id: string
  asset_type: EventAssetType
  storage_key: string
  file_size: bigint | null
  mime_type: string | null
  uploaded_at: Date
}

export function toPersistence(entity: EventAsset): Prisma.EventAssetUncheckedCreateInput {
  return {
    id: entity.id,
    event_id: entity.eventId,
    asset_type: entity.assetType,
    storage_key: entity.storageKey,
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
    fileSize: record.file_size,
    mimeType: record.mime_type,
    uploadedAt: record.uploaded_at,
  })
}

export function toProjection(
  record: EventAssetSelect,
  getPublicUrl: (key: string) => string,
): EventAssetProjection {
  return {
    id: record.id,
    assetType: record.asset_type,
    url: getPublicUrl(record.storage_key),
    fileSize: record.file_size ? Number(record.file_size) : null,
    mimeType: record.mime_type,
    uploadedAt: record.uploaded_at,
  }
}
