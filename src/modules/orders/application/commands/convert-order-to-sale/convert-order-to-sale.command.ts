import type { AuditContext } from '@shared/application'

export class ConvertOrderToSaleCommand {
  constructor(
    public readonly orderId: string,
    public readonly audit: AuditContext,
  ) {}
}
