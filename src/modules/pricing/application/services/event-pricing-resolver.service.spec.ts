import { Test } from '@nestjs/testing'
import {
  EVENT_PRICING_READ_REPOSITORY,
  type IEventPricingReadRepository,
} from '@pricing/domain/ports'
import { EventPricingResolver } from './event-pricing-resolver.service'

describe('EventPricingResolver', () => {
  let resolver: EventPricingResolver
  let repo: jest.Mocked<IEventPricingReadRepository>

  beforeEach(async () => {
    repo = {
      findConfigByEventId: jest.fn(),
    }
    const module = await Test.createTestingModule({
      providers: [EventPricingResolver, { provide: EVENT_PRICING_READ_REPOSITORY, useValue: repo }],
    }).compile()
    resolver = module.get(EventPricingResolver)
  })

  it('returns default tiers + USD when event has no config', async () => {
    repo.findConfigByEventId.mockResolvedValue(null)
    const r = await resolver.resolve('event-uuid')
    expect(r.source).toBe('default')
    expect(r.currency).toBe('USD')
    expect(r.tiers).toHaveLength(4)
    expect(r.tiers[0].minQty).toBe(1)
    expect(r.tiers[3].maxQty).toBeNull()
  })

  it('returns event-specific tiers when config exists', async () => {
    repo.findConfigByEventId.mockResolvedValue({
      currency: 'USD',
      tiers: [{ minQty: 1, maxQty: null, pricePerPhoto: 5 }],
    })
    const r = await resolver.resolve('event-uuid')
    expect(r.source).toBe('event')
    expect(r.tiers).toHaveLength(1)
    expect(r.tiers[0].pricePerPhoto).toBe(5)
  })

  it('falls back to default when stored config is malformed (empty tiers)', async () => {
    repo.findConfigByEventId.mockResolvedValue({ tiers: [], currency: 'USD' })
    const r = await resolver.resolve('event-uuid')
    expect(r.source).toBe('default')
  })
})
