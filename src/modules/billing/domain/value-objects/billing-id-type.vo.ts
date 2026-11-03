export const BillingIdType = {
  RUC: 'ruc',
  NATIONAL_ID: 'national_id',
  PASSPORT: 'passport',
} as const

export type BillingIdTypeValue = (typeof BillingIdType)[keyof typeof BillingIdType]
