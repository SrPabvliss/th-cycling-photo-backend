import type { AuditContext } from '@shared/application'

export class RegenerateDeliveryCommand {
  constructor(
    public readonly orderId: string,
    public readonly audit: AuditContext,
  ) {}
}
