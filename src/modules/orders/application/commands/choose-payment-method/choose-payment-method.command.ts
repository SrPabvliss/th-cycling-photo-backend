import type { PaymentMethodType } from '@orders/domain/value-objects/payment-method.vo'

export class ChoosePaymentMethodCommand {
  constructor(
    public readonly orderIds: string[],
    public readonly method: PaymentMethodType,
    public readonly buyerUserId: string,
  ) {}
}
