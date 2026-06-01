export interface PricingTierProjection {
  minQty: number
  maxQty: number | null
  pricePerPhoto: number
}

export interface PricingPreviewProjection {
  quantity: number
  unitPrice: number
  subtotal: number
  currency: string
  tier: PricingTierProjection
  nextTier: PricingTierProjection | null
  photosToNextTier: number | null
}
