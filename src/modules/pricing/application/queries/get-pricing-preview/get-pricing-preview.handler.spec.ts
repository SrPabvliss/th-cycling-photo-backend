import { Test } from '@nestjs/testing'
import { GetPricingPreviewHandler } from './get-pricing-preview.handler'
import { GetPricingPreviewQuery } from './get-pricing-preview.query'

describe('GetPricingPreviewHandler', () => {
  let handler: GetPricingPreviewHandler

  beforeEach(async () => {
    const mod = await Test.createTestingModule({
      providers: [GetPricingPreviewHandler],
    }).compile()
    handler = mod.get(GetPricingPreviewHandler)
  })

  it('returns preview for 7 photos → $2.50 × 7 = $17.50', async () => {
    const r = await handler.execute(new GetPricingPreviewQuery(7))
    expect(r.unitPrice).toBe(2.5)
    expect(r.subtotal).toBe(17.5)
    expect(r.currency).toBe('USD')
    expect(r.tier).toEqual({ minQty: 7, maxQty: 9, pricePerPhoto: 2.5 })
    expect(r.nextTier).toEqual({ minQty: 10, maxQty: null, pricePerPhoto: 2 })
    expect(r.photosToNextTier).toBe(3)
  })

  it('returns preview for 11 photos → $2 × 11 = $22 (top tier, no upgrade hint)', async () => {
    const r = await handler.execute(new GetPricingPreviewQuery(11))
    expect(r.unitPrice).toBe(2)
    expect(r.subtotal).toBe(22)
    expect(r.nextTier).toBeNull()
    expect(r.photosToNextTier).toBeNull()
  })
})
