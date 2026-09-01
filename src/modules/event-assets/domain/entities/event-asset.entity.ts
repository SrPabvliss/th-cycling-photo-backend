import { AppException } from '@shared/domain'
import { nanoid } from 'nanoid'
import type { EventAssetType } from '../value-objects/event-asset-type.enum'

const DEFAULT_FOCAL = 0.5

export class EventAsset {
  constructor(
    public readonly id: string,
    public readonly eventId: string,
    public readonly assetType: EventAssetType,
    public storageKey: string,
    public readonly publicSlug: string,
    public fileSize: bigint | null,
    public mimeType: string | null,
    public focalX: number,
    public focalY: number,
    public uploadedAt: Date,
  ) {}

  static create(data: {
    eventId: string
    assetType: EventAssetType
    storageKey: string
    fileSize: bigint | null
    mimeType: string | null
    focalX?: number
    focalY?: number
  }): EventAsset {
    EventAsset.validateStorageKey(data.storageKey)

    const asset = new EventAsset(
      crypto.randomUUID(),
      data.eventId,
      data.assetType,
      data.storageKey,
      nanoid(),
      data.fileSize,
      data.mimeType,
      DEFAULT_FOCAL,
      DEFAULT_FOCAL,
      new Date(),
    )
    asset.moveFocalPoint(data.focalX ?? DEFAULT_FOCAL, data.focalY ?? DEFAULT_FOCAL)
    return asset
  }

  /** Cloudflare reads gravity as a fraction of each side, so both values live in 0..1. */
  moveFocalPoint(x: number, y: number): void {
    if (!EventAsset.isFraction(x) || !EventAsset.isFraction(y)) {
      throw AppException.businessRule('event_asset.invalid_focal_point')
    }
    this.focalX = x
    this.focalY = y
  }

  static fromPersistence(data: {
    id: string
    eventId: string
    assetType: EventAssetType
    storageKey: string
    publicSlug: string
    fileSize: bigint | null
    mimeType: string | null
    focalX: number
    focalY: number
    uploadedAt: Date
  }): EventAsset {
    return new EventAsset(
      data.id,
      data.eventId,
      data.assetType,
      data.storageKey,
      data.publicSlug,
      data.fileSize,
      data.mimeType,
      data.focalX,
      data.focalY,
      data.uploadedAt,
    )
  }

  private static isFraction(value: number): boolean {
    return Number.isFinite(value) && value >= 0 && value <= 1
  }

  private static validateStorageKey(key: string): void {
    if (!key || key.length > 500) {
      throw AppException.businessRule('event_asset.invalid_storage_key')
    }
  }
}
