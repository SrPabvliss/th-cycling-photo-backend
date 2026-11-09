import type { EventDetailProjection } from '@events/application/projections'
import type { IEventReadRepository } from '@events/domain/ports'
import type { EventAggregate } from '@events/infrastructure/repositories/event-aggregates'
import type { IPhotoReadRepository } from '@photos/domain/ports'
import type { IAuthorizationService } from '@shared/authorization/domain/ports/authorization.service.port'
import { GetEventDetailHandler } from './get-event-detail.handler'
import { GetEventDetailQuery } from './get-event-detail.query'

const EVENT_ID = 'e1'

function makeAggregate(overrides: Partial<EventAggregate> = {}): EventAggregate {
  return {
    reviewedCount: 1200,
    categorizedCount: 640,
    revenue: '196.00',
    paidCount: 20,
    deliveredCount: 10,
    giftedCount: 2,
    unpaidCount: 4,
    cancelledCount: 0,
    lastUploadAt: new Date('2026-08-01T12:00:00Z'),
    soldPhotoCount: 72,
    ...overrides,
  }
}

function makeHandler(options: {
  aggregate?: EventAggregate
  event?: EventDetailProjection | null
}) {
  const event =
    options.event === null
      ? null
      : ({ id: EVENT_ID, ...options.event } as unknown as EventDetailProjection)

  const getAggregateByEvent = jest.fn().mockResolvedValue(options.aggregate)

  const readRepo = {
    getEventDetailBySlug: jest.fn().mockResolvedValue(event),
    getAggregateByEvent,
  } as unknown as IEventReadRepository

  const photoReadRepo = {
    getTotalFileSizeByEvent: jest.fn().mockResolvedValue(0),
    getClassifiedCountByEvent: jest.fn().mockResolvedValue(0),
  } as unknown as IPhotoReadRepository

  const authz = {
    resolveEventScope: jest.fn().mockResolvedValue({}),
  } as unknown as IAuthorizationService

  const handler = new GetEventDetailHandler(readRepo, photoReadRepo, authz)

  return { handler, getAggregateByEvent }
}

describe('GetEventDetailHandler — event figures', () => {
  it('serves revenue, sold photos, reviewed count and last upload from the aggregate', async () => {
    const { handler } = makeHandler({ aggregate: makeAggregate() })

    const result = await handler.execute(new GetEventDetailQuery('slug', 'user-1'))

    expect(result.revenue).toBe('196.00')
    expect(result.soldPhotoCount).toBe(72)
    expect(result.reviewedCount).toBe(1200)
    expect(result.lastUploadAt).toEqual(new Date('2026-08-01T12:00:00Z'))
  })

  it('carries the categorized count from the aggregate, separate from reviewed', async () => {
    const { handler } = makeHandler({ aggregate: makeAggregate() })

    const result = await handler.execute(new GetEventDetailQuery('slug', 'user-1'))

    expect(result.categorizedCount).toBe(640)
    expect(result.categorizedCount).not.toBe(result.reviewedCount)
  })

  it('counts orders as every non-draft status together', async () => {
    const { handler } = makeHandler({ aggregate: makeAggregate() })

    const result = await handler.execute(new GetEventDetailQuery('slug', 'user-1'))

    expect(result.ordersCount).toBe(36)
  })

  it('reports zeroes for an event that never sold', async () => {
    const { handler } = makeHandler({
      aggregate: makeAggregate({
        revenue: '0.00',
        paidCount: 0,
        deliveredCount: 0,
        giftedCount: 0,
        unpaidCount: 0,
        cancelledCount: 0,
        soldPhotoCount: 0,
        lastUploadAt: null,
      }),
    })

    const result = await handler.execute(new GetEventDetailQuery('slug', 'user-1'))

    expect(result.revenue).toBe('0.00')
    expect(result.ordersCount).toBe(0)
    expect(result.soldPhotoCount).toBe(0)
    expect(result.lastUploadAt).toBeNull()
  })

  it('still 404s an out-of-scope slug without asking for an aggregate', async () => {
    const { handler, getAggregateByEvent } = makeHandler({ event: null })

    await expect(handler.execute(new GetEventDetailQuery('nope', 'user-1'))).rejects.toThrow()
    expect(getAggregateByEvent).not.toHaveBeenCalled()
  })
})
