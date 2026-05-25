import type { EventSummaryProjection } from '@events/application/projections'
import type { IEventReadRepository } from '@events/domain/ports'
import { PaginatedResult, Pagination } from '@shared/application'
import type { CompletedEventStats, IOperatorReadRepository } from '../../../domain/ports'
import { GetCompletedEventsHandler } from './get-completed-events.handler'
import { GetCompletedEventsQuery } from './get-completed-events.query'

describe('GetCompletedEventsHandler', () => {
  let handler: GetCompletedEventsHandler
  let eventRead: jest.Mocked<Pick<IEventReadRepository, 'getAssignedEventsByStatus'>>
  let operatorRead: jest.Mocked<Pick<IOperatorReadRepository, 'getCompletedEventStats'>>

  beforeEach(() => {
    eventRead = { getAssignedEventsByStatus: jest.fn() }
    operatorRead = { getCompletedEventStats: jest.fn() }
    handler = new GetCompletedEventsHandler(eventRead as never, operatorRead as never)
  })

  it('returns empty when no completed events', async () => {
    const pagination = new Pagination(1, 20)
    eventRead.getAssignedEventsByStatus.mockResolvedValue(new PaginatedResult([], 0, pagination))
    const result = await handler.execute(new GetCompletedEventsQuery('op-1', pagination))
    expect(eventRead.getAssignedEventsByStatus).toHaveBeenCalledWith(
      'op-1',
      'completed',
      pagination,
    )
    expect(result.items).toEqual([])
  })

  it('composes event summary with completed stats and serializes completedAt', async () => {
    const pagination = new Pagination(1, 20)
    const event: EventSummaryProjection = {
      id: 'e-1',
      slug: 'evento-uno',
      name: 'Evento Uno',
      startDate: new Date('2026-04-01T00:00:00Z'),
      endDate: new Date('2026-04-01T00:00:00Z'),
      location: 'Quito',
      coverUrl: null,
      totalPhotos: 200,
    }
    eventRead.getAssignedEventsByStatus.mockResolvedValue(
      new PaginatedResult([event], 1, pagination),
    )
    const stats = new Map<string, CompletedEventStats>([
      ['e-1', { totalRetouched: 30, completedAt: new Date('2026-04-15T12:00:00Z') }],
    ])
    operatorRead.getCompletedEventStats.mockResolvedValue(stats)

    const result = await handler.execute(new GetCompletedEventsQuery('op-1', pagination))

    expect(result.items[0]).toEqual({
      event,
      stats: {
        totalRetouched: 30,
        completedAt: '2026-04-15T12:00:00.000Z',
      },
    })
  })

  it('serializes null completedAt and zero totals when stats missing', async () => {
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
    operatorRead.getCompletedEventStats.mockResolvedValue(new Map())

    const result = await handler.execute(new GetCompletedEventsQuery('op-2', pagination))

    expect(result.items[0].stats).toEqual({
      totalRetouched: 0,
      completedAt: null,
    })
  })
})
