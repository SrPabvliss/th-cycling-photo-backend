import type { EventAssetType } from '../../../domain/value-objects/event-asset-type.enum'

export class GenerateAssetPresignedUrlCommand {
  constructor(
    public readonly eventId: string,
    public readonly assetType: EventAssetType,
    public readonly fileName: string,
    public readonly contentType: string,
  ) {}
}
