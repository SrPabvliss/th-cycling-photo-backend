import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs'
import { PricingCalculator } from '@pricing/domain/services/pricing-calculator.service'
import {
  DEFAULT_CURRENCY,
  DEFAULT_PRICING_TIERS,
} from '@pricing/infrastructure/config/default-pricing-tiers'
import type { PricingPreviewProjection } from '../../projections/pricing-preview.projection'
import { GetPricingPreviewQuery } from './get-pricing-preview.query'

@QueryHandler(GetPricingPreviewQuery)
export class GetPricingPreviewHandler implements IQueryHandler<GetPricingPreviewQuery> {
  async execute(query: GetPricingPreviewQuery): Promise<PricingPreviewProjection> {
    const calc = PricingCalculator.calculate(query.photoCount, DEFAULT_PRICING_TIERS)

    return {
      quantity: calc.quantity,
      unitPrice: calc.unitPrice,
      subtotal: calc.subtotal,
      currency: DEFAULT_CURRENCY,
      tier: calc.tier.toJSON(),
      nextTier: calc.nextTier ? calc.nextTier.toJSON() : null,
      photosToNextTier: calc.photosToNextTier,
    }
  }
}
