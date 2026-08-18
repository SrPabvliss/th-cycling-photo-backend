export const PaymentMethod = {
  CARD: 'card',
  TRANSFER: 'transfer',
} as const

export type PaymentMethodType = (typeof PaymentMethod)[keyof typeof PaymentMethod]
