export const UNAUTHORISED_DOMAIN_CODE = 5
export const VALIDATION_FAILED_CODE = 800
export const RETRYABLE_ERROR_CODES = [500, 501]

export const ERROR_KEY_BY_CODE: Record<number, string> = {
  1: 'payment.invalid_credentials',
  5: 'payment.gateway_unavailable',
  20: 'payment.transaction_not_found',
  23: 'payment.duplicate_transaction',
  26: 'payment.card_daily_limit',
  100: 'payment.invalid_credentials',
  120: 'payment.phone_not_registered',
  802: 'payment.invalid_credentials',
  1004: 'payment.invalid_credentials',
}
