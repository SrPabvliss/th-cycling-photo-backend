import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs'
import {
  DEFAULT_CURRENCY,
  DEFAULT_PRICING_TIERS,
} from '@pricing/infrastructure/config/default-pricing-tiers'
import type { PricingTiersProjection } from '../../projections/pricing-tiers.projection'
import { GetPricingTiersQuery } from './get-pricing-tiers.query'

@QueryHandler(GetPricingTiersQuery)
export class GetPricingTiersHandler implements IQueryHandler<GetPricingTiersQuery> {
  async execute(_query: GetPricingTiersQuery): Promise<PricingTiersProjection> {
    return {
      currency: DEFAULT_CURRENCY,
      source: 'default',
      tiers: DEFAULT_PRICING_TIERS.map((t) => t.toJSON()),
    }
  }
}
