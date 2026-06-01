import { Inject, Injectable, Logger } from '@nestjs/common'
import {
  EVENT_PRICING_READ_REPOSITORY,
  type IEventPricingReadRepository,
} from '@pricing/domain/ports'
import { PricingTier } from '@pricing/domain/value-objects/pricing-tier.vo'
import {
  DEFAULT_CURRENCY,
  DEFAULT_PRICING_TIERS,
} from '@pricing/infrastructure/config/default-pricing-tiers'

export interface ResolvedPricing {
  tiers: readonly PricingTier[]
  currency: string
  source: 'event' | 'default'
}

/**
 * Resolves the pricing tiers and currency for a single event, falling back to
 * the system defaults when no per-event override is configured.
 *
 * STATUS: currently unused in the checkout flow. The cart applies pricing at
 * the cart level (sum across events) using DEFAULT_PRICING_TIERS directly —
 * see CheckoutCartHandler. This resolver is kept ready for when per-event
 * pricing overrides go live (bucket logic in checkout). Do not delete: the
 * admin endpoints already write `Event.pricing_config`, and this resolver
 * is the read path that future code will plug into.
 *
 * Linked follow-up: bucket-aware checkout when overrides are introduced.
 */
@Injectable()
export class EventPricingResolver {
  private readonly logger = new Logger(EventPricingResolver.name)

  constructor(
    @Inject(EVENT_PRICING_READ_REPOSITORY)
    private readonly repo: IEventPricingReadRepository,
  ) {}

  async resolve(eventId: string): Promise<ResolvedPricing> {
    const config = await this.repo.findConfigByEventId(eventId)
    if (!config) return this.defaultResolved()

    try {
      if (!Array.isArray(config.tiers) || config.tiers.length === 0) {
        throw new Error('empty tiers')
      }
      const tiers = config.tiers.map((t) =>
        PricingTier.create({
          minQty: t.minQty,
          maxQty: t.maxQty,
          pricePerPhoto: t.pricePerPhoto,
        }),
      )
      return {
        tiers,
        currency: config.currency || DEFAULT_CURRENCY,
        source: 'event',
      }
    } catch (err) {
      this.logger.warn(
        `Event ${eventId} has malformed pricing_config, falling back to defaults: ${(err as Error).message}`,
      )
      return this.defaultResolved()
    }
  }

  private defaultResolved(): ResolvedPricing {
    return { tiers: DEFAULT_PRICING_TIERS, currency: DEFAULT_CURRENCY, source: 'default' }
  }
}
