export const PaymentTransactionStatus = {
  INITIATED: 'initiated',
  CONFIRMING: 'confirming',
  APPROVED: 'approved',
  DECLINED: 'declined',
  EXPIRED: 'expired',
  REVERSED: 'reversed',
} as const

export type PaymentTransactionStatusType =
  (typeof PaymentTransactionStatus)[keyof typeof PaymentTransactionStatus]
