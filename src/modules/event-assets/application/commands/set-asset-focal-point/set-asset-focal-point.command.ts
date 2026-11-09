import type { EventAssetType } from '../../../domain/value-objects/event-asset-type.enum'

export class SetAssetFocalPointCommand {
  constructor(
    public readonly eventId: string,
    public readonly assetType: EventAssetType,
    public readonly focalX: number,
    public readonly focalY: number,
    public readonly userId: string,
  ) {}
}
