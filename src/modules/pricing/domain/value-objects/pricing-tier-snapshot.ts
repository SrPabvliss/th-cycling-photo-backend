/**
 * Plain serialized shape of a PricingTier as stored on Order.snap_pricing_config.
 * Use this when reading/writing the persisted JSON column — not for in-domain logic.
 */
export interface PricingTierSnapshot {
  minQty: number
  maxQty: number | null
  pricePerPhoto: number
}
