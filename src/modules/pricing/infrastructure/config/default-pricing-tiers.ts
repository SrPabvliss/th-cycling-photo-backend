import { PricingTier } from '../../domain/value-objects/pricing-tier.vo'

export const DEFAULT_CURRENCY = 'USD'

export const DEFAULT_PRICING_TIERS: readonly PricingTier[] = Object.freeze([
  PricingTier.create({ minQty: 1, maxQty: 2, pricePerPhoto: 4.0 }),
  PricingTier.create({ minQty: 3, maxQty: 6, pricePerPhoto: 3.0 }),
  PricingTier.create({ minQty: 7, maxQty: 9, pricePerPhoto: 2.5 }),
  PricingTier.create({ minQty: 10, maxQty: null, pricePerPhoto: 2.0 }),
])
