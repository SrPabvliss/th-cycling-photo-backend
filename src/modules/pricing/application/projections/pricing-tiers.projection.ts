import type { PricingTierProjection } from './pricing-preview.projection'

export interface PricingTiersProjection {
  currency: string
  source: 'event' | 'default'
  tiers: PricingTierProjection[]
}
