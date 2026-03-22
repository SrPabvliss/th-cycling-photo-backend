import type { AuditContext } from '@shared/application'

export class ConfirmOrderPaymentCommand {
  constructor(
    public readonly orderId: string,
    public readonly audit: AuditContext,
  ) {}
}
