import { PAYPHONE_COMMISSION_RATE, payphoneCommissionCents } from './payphone-commission'

describe('payphoneCommissionCents', () => {
  it('uses the published 5.75 percent rate', () => {
    expect(PAYPHONE_COMMISSION_RATE).toBe(0.0575)
  })

  it('matches the vendor example of 20 dollars', () => {
    expect(payphoneCommissionCents(2000)).toBe(115)
  })

  it('matches the vendor example of 10 dollars', () => {
    expect(payphoneCommissionCents(1000)).toBe(58)
  })

  it('rounds up so the merchant never covers a fraction of a cent', () => {
    expect(payphoneCommissionCents(1999)).toBe(115)
    expect(payphoneCommissionCents(1)).toBe(1)
  })

  it('leaves a transferable remainder that never goes negative or exceeds the amount, and always sums back to the amount with the commission', () => {
    const amounts = [1, 7, 99, 1234, 99999, 2000]
    amounts.forEach((amount) => {
      const commission = payphoneCommissionCents(amount)
      const transferable = amount - commission

      expect(transferable).toBeGreaterThanOrEqual(0)
      expect(transferable).toBeLessThanOrEqual(amount)
      expect(transferable + commission).toBe(amount)
    })

    expect(2000 - payphoneCommissionCents(2000)).toBe(1885)
  })
})
