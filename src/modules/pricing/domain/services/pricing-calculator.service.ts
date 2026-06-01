import { AppException } from '@shared/domain'
import type { PricingTier } from '../value-objects/pricing-tier.vo'

export interface PricingCalculation {
  quantity: number
  unitPrice: number
  subtotal: number
  tier: PricingTier
  nextTier: PricingTier | null
  photosToNextTier: number | null
}

export const PricingCalculator = {
  calculate(quantity: number, tiers: readonly PricingTier[]): PricingCalculation {
    if (!Number.isInteger(quantity) || quantity < 1) {
      throw AppException.businessRule('pricing.invalid_quantity')
    }
    if (tiers.length === 0) {
      throw AppException.businessRule('pricing.no_tiers_configured')
    }

    const sorted = [...tiers].sort((a, b) => a.minQty - b.minQty)
    const tier = sorted.find((t) => t.matches(quantity))
    if (!tier) throw AppException.businessRule('pricing.quantity_not_covered')

    const tierIndex = sorted.indexOf(tier)
    const nextTier = sorted[tierIndex + 1] ?? null
    const photosToNextTier = nextTier ? nextTier.minQty - quantity : null

    const unitPrice = tier.pricePerPhoto
    const subtotal = Math.round(unitPrice * quantity * 100) / 100

    return { quantity, unitPrice, subtotal, tier, nextTier, photosToNextTier }
  },
}
