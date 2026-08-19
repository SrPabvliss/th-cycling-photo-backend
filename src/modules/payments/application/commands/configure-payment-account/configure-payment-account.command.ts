import type { PaymentModeType } from '@payments/domain/value-objects/payment-mode.vo'

export class ConfigurePaymentAccountCommand {
  constructor(
    public readonly userId: string,
    public readonly mode: PaymentModeType,
    public readonly phone: string | null,
    public readonly token: string | null,
    public readonly storeId: string | null,
  ) {}
}
