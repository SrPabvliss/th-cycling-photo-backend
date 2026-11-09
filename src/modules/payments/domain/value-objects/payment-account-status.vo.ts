export const PaymentAccountStatus = {
  PENDING: 'pending',
  VERIFIED: 'verified',
  DISABLED: 'disabled',
} as const

export type PaymentAccountStatusType =
  (typeof PaymentAccountStatus)[keyof typeof PaymentAccountStatus]
