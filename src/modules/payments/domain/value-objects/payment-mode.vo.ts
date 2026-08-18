export const PaymentMode = {
  OWN_MERCHANT: 'own_merchant',
  SPLIT_RECEIVER: 'split_receiver',
} as const

export type PaymentModeType = (typeof PaymentMode)[keyof typeof PaymentMode]
