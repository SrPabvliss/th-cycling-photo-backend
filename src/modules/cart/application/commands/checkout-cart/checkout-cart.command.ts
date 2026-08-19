import type { PaymentMethodType } from '@orders/domain/value-objects/payment-method.vo'

export class CheckoutCartItem {
  eventId: string
  bibNumber: string | null
  snapCategoryName: string | null
}

export class CheckoutCartCommand {
  constructor(
    public readonly userId: string,
    public readonly items: CheckoutCartItem[],
    public readonly method: PaymentMethodType,
  ) {}
}
