import type { AuditContext } from '@shared/application'

export class GiftOrderCommand {
  constructor(
    public readonly orderId: string,
    public readonly audit: AuditContext,
  ) {}
}
