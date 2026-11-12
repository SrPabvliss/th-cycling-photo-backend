import type { BillingIdTypeValue } from '../../../domain/value-objects/billing-id-type.vo'

/** A field left out is not touched. `address: null` clears the address. */
export interface BillingAccountChanges {
  idType?: BillingIdTypeValue
  idNumber?: string
  legalName?: string
  email?: string
  address?: string | null
}

export class UpdateBillingAccountCommand {
  constructor(
    public readonly userId: string,
    public readonly billingAccountId: string,
    public readonly changes: BillingAccountChanges,
  ) {}
}
