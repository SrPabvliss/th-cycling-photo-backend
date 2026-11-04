import type { BillingIdTypeValue } from '@billing/domain/value-objects/billing-id-type.vo'

export class CorrectOrderBillingCommand {
  constructor(
    public readonly orderId: string,
    public readonly userId: string,
    public readonly idType: BillingIdTypeValue,
    public readonly idNumber: string,
    public readonly legalName: string,
    public readonly email: string,
    public readonly address: string | null,
  ) {}
}
