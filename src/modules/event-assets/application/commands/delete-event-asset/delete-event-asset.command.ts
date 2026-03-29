import type { EventAssetType } from '@generated/prisma/client'

export class DeleteEventAssetCommand {
  constructor(
    public readonly eventId: string,
    public readonly assetType: EventAssetType,
  ) {}
}
