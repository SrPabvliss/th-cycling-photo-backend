import { AppException } from '@shared/domain'

export class PricingTier {
  private constructor(
    public readonly minQty: number,
    public readonly maxQty: number | null,
    public readonly pricePerPhoto: number,
  ) {
    Object.freeze(this)
  }

  static create(data: {
    minQty: number
    maxQty: number | null
    pricePerPhoto: number
  }): PricingTier {
    if (!Number.isInteger(data.minQty) || data.minQty < 1) {
      throw AppException.businessRule('pricing.invalid_tier_min_qty')
    }
    if (data.maxQty !== null && (!Number.isInteger(data.maxQty) || data.maxQty < data.minQty)) {
      throw AppException.businessRule('pricing.invalid_tier_max_qty')
    }
    if (data.pricePerPhoto < 0) {
      throw AppException.businessRule('pricing.invalid_tier_price')
    }
    return new PricingTier(data.minQty, data.maxQty, data.pricePerPhoto)
  }

  matches(quantity: number): boolean {
    if (quantity < this.minQty) return false
    if (this.maxQty === null) return true
    return quantity <= this.maxQty
  }

  toJSON(): { minQty: number; maxQty: number | null; pricePerPhoto: number } {
    return { minQty: this.minQty, maxQty: this.maxQty, pricePerPhoto: this.pricePerPhoto }
  }
}
