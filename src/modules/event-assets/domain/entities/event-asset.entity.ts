import { AppException } from '@shared/domain'
import type { EventAssetType } from '../value-objects/event-asset-type.enum'

export class EventAsset {
  constructor(
    public readonly id: string,
    public readonly eventId: string,
    public readonly assetType: EventAssetType,
    public storageKey: string,
    public fileSize: bigint | null,
    public mimeType: string | null,
    public uploadedAt: Date,
  ) {}

  static create(data: {
    eventId: string
    assetType: EventAssetType
    storageKey: string
    fileSize: bigint | null
    mimeType: string | null
  }): EventAsset {
    EventAsset.validateStorageKey(data.storageKey)

    return new EventAsset(
      crypto.randomUUID(),
      data.eventId,
      data.assetType,
      data.storageKey,
      data.fileSize,
      data.mimeType,
      new Date(),
    )
  }

  static fromPersistence(data: {
    id: string
    eventId: string
    assetType: EventAssetType
    storageKey: string
    fileSize: bigint | null
    mimeType: string | null
    uploadedAt: Date
  }): EventAsset {
    return new EventAsset(
      data.id,
      data.eventId,
      data.assetType,
      data.storageKey,
      data.fileSize,
      data.mimeType,
      data.uploadedAt,
    )
  }

  private static validateStorageKey(key: string): void {
    if (!key || key.length > 500) {
      throw AppException.businessRule('event_asset.invalid_storage_key')
    }
  }
}
