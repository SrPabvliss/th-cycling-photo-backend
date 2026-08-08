import type { AuditContext } from '@shared/application'

export class ConvertOrderToGiftCommand {
  constructor(
    public readonly orderId: string,
    public readonly audit: AuditContext,
  ) {}
}
