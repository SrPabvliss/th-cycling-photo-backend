import type { AuditContext } from '@shared/application'

export interface PhotoBatchItem {
  fileName: string
  fileSize: number
  objectKey: string
  contentType: string
}

export class ConfirmPhotoBatchCommand {
  constructor(
    public readonly eventId: string,
    public readonly photos: PhotoBatchItem[],
    public readonly audit?: AuditContext,
  ) {}
}
