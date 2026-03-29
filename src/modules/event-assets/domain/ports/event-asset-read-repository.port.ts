import type { EventAssetType } from '@generated/prisma/client'
import type { EventAssetProjection } from '../../application/projections'
import type { EventAsset } from '../entities'

export interface IEventAssetReadRepository {
  findByEventAndType(eventId: string, assetType: EventAssetType): Promise<EventAsset | null>
  getByEvent(eventId: string): Promise<EventAssetProjection[]>
}

export const EVENT_ASSET_READ_REPOSITORY = Symbol('EVENT_ASSET_READ_REPOSITORY')
