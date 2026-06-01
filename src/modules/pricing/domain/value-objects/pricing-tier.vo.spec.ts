import { PricingTier } from './pricing-tier.vo'

describe('PricingTier', () => {
  it('creates a closed tier (min 1, max 2, price 4)', () => {
    const tier = PricingTier.create({ minQty: 1, maxQty: 2, pricePerPhoto: 4 })
    expect(tier.minQty).toBe(1)
    expect(tier.maxQty).toBe(2)
    expect(tier.pricePerPhoto).toBe(4)
  })

  it('creates an open-ended tier (max null)', () => {
    const tier = PricingTier.create({ minQty: 10, maxQty: null, pricePerPhoto: 2 })
    expect(tier.maxQty).toBeNull()
  })

  it('matches a quantity inside the range', () => {
    const tier = PricingTier.create({ minQty: 3, maxQty: 6, pricePerPhoto: 3 })
    expect(tier.matches(3)).toBe(true)
    expect(tier.matches(6)).toBe(true)
    expect(tier.matches(2)).toBe(false)
    expect(tier.matches(7)).toBe(false)
  })

  it('open-ended tier matches any quantity above min', () => {
    const tier = PricingTier.create({ minQty: 10, maxQty: null, pricePerPhoto: 2 })
    expect(tier.matches(10)).toBe(true)
    expect(tier.matches(9999)).toBe(true)
    expect(tier.matches(9)).toBe(false)
  })

  it('rejects minQty < 1', () => {
    expect(() => PricingTier.create({ minQty: 0, maxQty: 2, pricePerPhoto: 4 })).toThrow()
  })

  it('rejects maxQty < minQty', () => {
    expect(() => PricingTier.create({ minQty: 5, maxQty: 3, pricePerPhoto: 4 })).toThrow()
  })

  it('rejects negative price', () => {
    expect(() => PricingTier.create({ minQty: 1, maxQty: 2, pricePerPhoto: -1 })).toThrow()
  })
})
