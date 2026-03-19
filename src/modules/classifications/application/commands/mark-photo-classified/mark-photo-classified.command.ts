import type { AuditContext } from '@shared/application'

export class MarkPhotoClassifiedCommand {
  constructor(
    public readonly photoId: string,
    public readonly audit?: AuditContext,
  ) {}
}
