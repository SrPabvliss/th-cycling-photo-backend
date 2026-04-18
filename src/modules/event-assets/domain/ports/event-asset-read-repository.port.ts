import type { EventAssetProjection } from '../../application/projections'
import type { EventAsset } from '../entities'
import type { EventAssetType } from '../value-objects/event-asset-type.enum'

export interface IEventAssetReadRepository {
  findByEventAndType(eventId: string, assetType: EventAssetType): Promise<EventAsset | null>
  getByEvent(eventId: string): Promise<EventAssetProjection[]>
}

export const EVENT_ASSET_READ_REPOSITORY = Symbol('EVENT_ASSET_READ_REPOSITORY')
