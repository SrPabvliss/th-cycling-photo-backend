import type { EventAsset } from '../entities'

export interface IEventAssetWriteRepository {
  save(asset: EventAsset): Promise<EventAsset>
  delete(id: string): Promise<void>
}

export const EVENT_ASSET_WRITE_REPOSITORY = Symbol('EVENT_ASSET_WRITE_REPOSITORY')
