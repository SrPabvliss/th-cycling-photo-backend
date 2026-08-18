import { AppException } from '@shared/domain'

export function toCents(dollars: number): number {
  if (dollars < 0) throw AppException.businessRule('payment.negative_amount')
  return Math.round(dollars * 100)
}
