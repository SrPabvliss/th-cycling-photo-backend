import type { AuditContext } from '@shared/application'

export class CreatePreviewLinkCommand {
  constructor(
    public readonly eventId: string,
    public readonly photoIds: string[],
    public readonly expiresInDays: number,
    public readonly audit: AuditContext,
  ) {}
}
