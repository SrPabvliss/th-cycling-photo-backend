export const EVENT_PRICING_READ_REPOSITORY = Symbol('EVENT_PRICING_READ_REPOSITORY')

export interface RawPricingConfig {
  tiers: { minQty: number; maxQty: number | null; pricePerPhoto: number }[]
  currency: string
}

export interface IEventPricingReadRepository {
  findConfigByEventId(eventId: string): Promise<RawPricingConfig | null>
}
