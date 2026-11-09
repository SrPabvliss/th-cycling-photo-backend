import { PaymentAmountCalculator } from './payment-amount-calculator.service'

describe('PaymentAmountCalculator', () => {
  const calculator = new PaymentAmountCalculator()

  it('reports the whole sale as untaxed when the rate is zero', () => {
    const amounts = calculator.fromSubtotal(20, 0)

    expect(amounts.amountCents).toBe(2000)
    expect(amounts.amountWithoutTaxCents).toBe(2000)
    expect(amounts.amountWithTaxCents).toBe(0)
    expect(amounts.taxCents).toBe(0)
  })

  it('splits base and tax when a rate applies', () => {
    const amounts = calculator.fromSubtotal(11.5, 0.15)

    expect(amounts.amountWithoutTaxCents).toBe(0)
    expect(amounts.amountWithTaxCents).toBe(1000)
    expect(amounts.taxCents).toBe(150)
    expect(amounts.amountCents).toBe(1150)
  })

  it('always satisfies the vendor sum rule', () => {
    const cases: [number, number][] = [
      [20, 0],
      [19.99, 0],
      [11.5, 0.15],
      [3.33, 0.15],
      [0.01, 0],
    ]

    cases.forEach(([subtotal, rate]) => {
      const a = calculator.fromSubtotal(subtotal, rate)
      expect(a.amountWithoutTaxCents + a.amountWithTaxCents + a.taxCents).toBe(a.amountCents)
    })
  })

  it('never emits a tax without a taxable base', () => {
    const amounts = calculator.fromSubtotal(3.33, 0.15)

    expect(amounts.taxCents).toBeGreaterThan(0)
    expect(amounts.amountWithTaxCents).toBeGreaterThan(0)
  })

  it('rejects a subtotal of zero', () => {
    expect(() => calculator.fromSubtotal(0, 0)).toThrow()
  })
})
