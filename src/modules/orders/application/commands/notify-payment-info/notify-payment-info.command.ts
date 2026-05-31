import type { AuditContext } from '@shared/application'

export class NotifyPaymentInfoCommand {
  constructor(
    public readonly orderId: string,
    public readonly audit: AuditContext,
  ) {}
}
