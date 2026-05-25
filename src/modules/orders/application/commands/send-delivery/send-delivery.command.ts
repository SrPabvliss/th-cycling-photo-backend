import type { AuditContext } from '@shared/application'

export class SendDeliveryCommand {
  constructor(
    public readonly orderId: string,
    public readonly audit: AuditContext,
  ) {}
}
