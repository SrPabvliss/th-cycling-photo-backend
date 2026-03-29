import type { EventAssetType } from '@generated/prisma/client'

export class ConfirmAssetUploadCommand {
  constructor(
    public readonly eventId: string,
    public readonly assetType: EventAssetType,
    public readonly storageKey: string,
    public readonly fileSize: bigint | null,
    public readonly mimeType: string | null,
  ) {}
}
