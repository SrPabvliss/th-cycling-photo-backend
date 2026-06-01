import { PricingTier } from '../value-objects/pricing-tier.vo'
import { PricingCalculator } from './pricing-calculator.service'

const TIERS = [
  PricingTier.create({ minQty: 1, maxQty: 2, pricePerPhoto: 4 }),
  PricingTier.create({ minQty: 3, maxQty: 6, pricePerPhoto: 3 }),
  PricingTier.create({ minQty: 7, maxQty: 9, pricePerPhoto: 2.5 }),
  PricingTier.create({ minQty: 10, maxQty: null, pricePerPhoto: 2 }),
]

describe('PricingCalculator', () => {
  it.each([
    [1, 4, 4],
    [2, 4, 8],
    [3, 3, 9],
    [6, 3, 18],
    [7, 2.5, 17.5],
    [9, 2.5, 22.5],
    [10, 2, 20],
    [25, 2, 50],
  ])('flat calc: %i photos × $%s = $%s', (qty, unit, subtotal) => {
    const r = PricingCalculator.calculate(qty, TIERS)
    expect(r.unitPrice).toBe(unit)
    expect(r.subtotal).toBe(subtotal)
    expect(r.quantity).toBe(qty)
  })

  it('returns the matched tier in the result', () => {
    const r = PricingCalculator.calculate(5, TIERS)
    expect(r.tier.minQty).toBe(3)
    expect(r.tier.maxQty).toBe(6)
  })

  it('returns next tier suggestion when one exists', () => {
    const r = PricingCalculator.calculate(2, TIERS)
    expect(r.nextTier).not.toBeNull()
    expect(r.nextTier?.minQty).toBe(3)
    expect(r.photosToNextTier).toBe(1)
  })

  it('returns null nextTier on the top open tier', () => {
    const r = PricingCalculator.calculate(15, TIERS)
    expect(r.nextTier).toBeNull()
    expect(r.photosToNextTier).toBeNull()
  })

  it('throws when quantity is 0 or negative', () => {
    expect(() => PricingCalculator.calculate(0, TIERS)).toThrow()
    expect(() => PricingCalculator.calculate(-1, TIERS)).toThrow()
  })

  it('throws when tiers do not cover the quantity (gap)', () => {
    const incomplete = [PricingTier.create({ minQty: 1, maxQty: 2, pricePerPhoto: 4 })]
    expect(() => PricingCalculator.calculate(5, incomplete)).toThrow()
  })

  it('throws when tiers list is empty', () => {
    expect(() => PricingCalculator.calculate(1, [])).toThrow()
  })
})
