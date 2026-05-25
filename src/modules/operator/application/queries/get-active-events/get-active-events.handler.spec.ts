import type { EventSummaryProjection } from '@events/application/projections'
import type { IEventReadRepository } from '@events/domain/ports'
import { PaginatedResult, Pagination } from '@shared/application'
import type { ActiveEventStats, IOperatorReadRepository } from '../../../domain/ports'
import { GetActiveEventsHandler } from './get-active-events.handler'
import { GetActiveEventsQuery } from './get-active-events.query'

describe('GetActiveEventsHandler', () => {
  let handler: GetActiveEventsHandler
  let eventRead: jest.Mocked<Pick<IEventReadRepository, 'getAssignedEventsByStatus'>>
  let operatorRead: jest.Mocked<Pick<IOperatorReadRepository, 'getActiveEventStats'>>

  beforeEach(() => {
    eventRead = { getAssignedEventsByStatus: jest.fn() }
    operatorRead = { getActiveEventStats: jest.fn() }
    handler = new GetActiveEventsHandler(eventRead as never, operatorRead as never)
  })

  it('returns empty PaginatedResult when there are no assigned events', async () => {
    const pagination = new Pagination(1, 20)
    eventRead.getAssignedEventsByStatus.mockResolvedValue(new PaginatedResult([], 0, pagination))

    const result = await handler.execute(new GetActiveEventsQuery('op-1', pagination))

    expect(eventRead.getAssignedEventsByStatus).toHaveBeenCalledWith('op-1', 'active', pagination)
    expect(operatorRead.getActiveEventStats).not.toHaveBeenCalled()
    expect(result.items).toEqual([])
    expect(result.total).toBe(0)
  })

  it('composes event summary with operator stats per event', async () => {
    const pagination = new Pagination(1, 20)
    const event: EventSummaryProjection = {
      id: 'e-1',
      slug: 'evento-uno',
      name: 'Evento Uno',
      startDate: new Date('2026-04-01T00:00:00Z'),
      endDate: new Date('2026-04-01T00:00:00Z'),
      location: 'Quito',
      coverUrl: 'https://cdn.test/x.jpg',
      totalPhotos: 10,
    }
    eventRead.getAssignedEventsByStatus.mockResolvedValue(
      new PaginatedResult([event], 1, pagination),
    )
    const stats = new Map<string, ActiveEventStats>([
      ['e-1', { pendingPhotos: 3, totalProcessedPhotos: 7, retouchPendingPhotos: 2 }],
    ])
    operatorRead.getActiveEventStats.mockResolvedValue(stats)

    const result = await handler.execute(new GetActiveEventsQuery('op-1', pagination))

    expect(operatorRead.getActiveEventStats).toHaveBeenCalledWith(['e-1'])
    expect(result.items).toHaveLength(1)
    expect(result.items[0]).toEqual({
      event,
      stats: {
        review: { pendingPhotos: 3, totalProcessedPhotos: 7 },
        retouch: { pendingPhotos: 2 },
      },
    })
  })

  it('falls back to zero stats when an event id has no stats entry', async () => {
    const pagination = new Pagination(1, 20)
    const event: EventSummaryProjection = {
      id: 'e-2',
      slug: 'evento-dos',
      name: 'Evento Dos',
      startDate: new Date('2026-04-01T00:00:00Z'),
      endDate: new Date('2026-04-01T00:00:00Z'),
      location: 'Quito',
      coverUrl: null,
      totalPhotos: 0,
    }
    eventRead.getAssignedEventsByStatus.mockResolvedValue(
      new PaginatedResult([event], 1, pagination),
    )
    operatorRead.getActiveEventStats.mockResolvedValue(new Map())

    const result = await handler.execute(new GetActiveEventsQuery('op-1', pagination))

    expect(result.items[0].stats).toEqual({
      review: { pendingPhotos: 0, totalProcessedPhotos: 0 },
      retouch: { pendingPhotos: 0 },
    })
  })
})
