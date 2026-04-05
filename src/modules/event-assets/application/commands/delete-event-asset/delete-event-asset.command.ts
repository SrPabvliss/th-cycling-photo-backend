import type { EventAssetType } from '../../../domain/value-objects/event-asset-type.enum'

export class DeleteEventAssetCommand {
  constructor(
    public readonly eventId: string,
    public readonly assetType: EventAssetType,
  ) {}
}
