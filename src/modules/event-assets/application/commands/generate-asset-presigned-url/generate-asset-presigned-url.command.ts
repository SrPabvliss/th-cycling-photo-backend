import type { EventAssetType } from '@generated/prisma/client'

export class GenerateAssetPresignedUrlCommand {
  constructor(
    public readonly eventId: string,
    public readonly assetType: EventAssetType,
    public readonly fileName: string,
    public readonly contentType: string,
  ) {}
}
