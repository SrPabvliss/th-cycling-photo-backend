export const PAYPHONE_COMMISSION_RATE = 0.0575

export function payphoneCommissionCents(amountCents: number): number {
  return Math.ceil(amountCents * PAYPHONE_COMMISSION_RATE)
}
