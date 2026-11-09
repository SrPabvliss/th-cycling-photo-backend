export const PayoutProvider = {
  PAYPHONE: 'payphone',
  BANK_TRANSFER: 'bank_transfer',
} as const

export type PayoutProviderType = (typeof PayoutProvider)[keyof typeof PayoutProvider]
