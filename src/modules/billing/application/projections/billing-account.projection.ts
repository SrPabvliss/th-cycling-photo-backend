import type { BillingIdTypeValue } from '../../domain/value-objects/billing-id-type.vo'

export class BillingAccountProjection {
  /** Billing account UUID */
  id: string
  /** Identification type: ruc, national_id or passport */
  idType: BillingIdTypeValue
  /** Identification number */
  idNumber: string
  /** Full name or company name */
  legalName: string
  /** Email the invoice is sent to */
  email: string
  /** Address, when given */
  address: string | null
  /** Whether this is the default account */
  isDefault: boolean
}

export class MyBillingAccountsProjection {
  /** Active billing accounts, default first */
  accounts: BillingAccountProjection[]
  /** Whether the user has the current electronic invoice consent */
  invoiceConsentGiven: boolean
}
