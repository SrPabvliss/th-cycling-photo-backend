export const ACCOUNT_TYPES = ['ahorros', 'corriente'] as const

export type AccountType = (typeof ACCOUNT_TYPES)[number]

export const MIN_PUBLIC_NAME_LENGTH = 3
export const MIN_BANK_NAME_LENGTH = 3
export const MIN_ACCOUNT_HOLDER_LENGTH = 3

export const MAX_PUBLIC_NAME_LENGTH = 200
export const MAX_BANK_NAME_LENGTH = 100
export const MAX_ACCOUNT_NUMBER_LENGTH = 50
export const MAX_ACCOUNT_TYPE_LENGTH = 20
export const MAX_ACCOUNT_HOLDER_LENGTH = 200
export const MAX_HOLDER_IDENTIFICATION_LENGTH = 20

export const ACCOUNT_NUMBER_PATTERN = /^\d{5,}$/

export const HOLDER_IDENTIFICATION_PATTERN = /^(\d{10}|\d{13})$/

export const normalizeAccountType = (value: unknown): unknown =>
  typeof value === 'string' ? value.trim().toLowerCase() : value
