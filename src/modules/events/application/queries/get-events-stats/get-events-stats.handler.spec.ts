import type { EventsStatsProjection } from '@events/application/projections'
import type { IEventReadRepository } from '@events/domain/ports'
import { EventScope } from '@shared/authorization/domain/event-scope.vo'
import type { IAuthorizationService } from '@shared/authorization/domain/ports/authorization.service.port'
import { GetEventsStatsHandler } from './get-events-stats.handler'
import { GetEventsStatsQuery } from './get-events-stats.query'

describe('GetEventsStatsHandler', () => {
  let handler: GetEventsStatsHandler
  let eventReadRepo: jest.Mocked<Pick<IEventReadRepository, 'getEventsStats'>>
  let authz: jest.Mocked<Pick<IAuthorizationService, 'resolveEventScope'>>

  const stats: EventsStatsProjection = {
    totalEvents: 8,
    activeEvents: 7,
    visibleEvents: 6,
    photosOnline: 8,
    pendingReview: 5,
    eventsPendingReview: 3,
    nearOrOverQuota: 1,
    revenue: '16.75',
    orders: 5,
    unpaidOrders: 0,
    tabs: { all: 8, active: 7, no_cover: 1, frozen: 1, archived: 1 },
  }

  beforeEach(() => {
    eventReadRepo = { getEventsStats: jest.fn() }
    authz = { resolveEventScope: jest.fn() }
    handler = new GetEventsStatsHandler(eventReadRepo as never, authz as never)
  })

  it('scopes the aggregation to the caller scope, honouring search and organizerId (closes the cross-tenant leak — Ruling 20)', async () => {
    const tenantScope = new EventScope(false, ['tenant-a'], [])
    authz.resolveEventScope.mockResolvedValue(tenantScope)
    eventReadRepo.getEventsStats.mockResolvedValue(stats)

    const filters = { search: 'MTB', organizerId: 'tenant-a' }
    const result = await handler.execute(new GetEventsStatsQuery(filters, 'u1'))

    expect(authz.resolveEventScope).toHaveBeenCalledWith('u1')
    expect(eventReadRepo.getEventsStats).toHaveBeenCalledWith(filters, tenantScope)
    expect(result).toEqual(stats)
  })

  it('an unrestricted (platform) caller still sees platform-wide figures', async () => {
    const unrestricted = EventScope.unrestricted()
    authz.resolveEventScope.mockResolvedValue(unrestricted)
    eventReadRepo.getEventsStats.mockResolvedValue(stats)

    const result = await handler.execute(new GetEventsStatsQuery({}, 'platform-admin'))

    expect(eventReadRepo.getEventsStats).toHaveBeenCalledWith({}, unrestricted)
    expect(result).toEqual(stats)
  })

  it('passes the filters through untouched even when a tab is supplied — the repository ignores it', async () => {
    const scope = EventScope.unrestricted()
    authz.resolveEventScope.mockResolvedValue(scope)
    eventReadRepo.getEventsStats.mockResolvedValue(stats)

    const filters = { tab: 'frozen' as const }
    await handler.execute(new GetEventsStatsQuery(filters, 'u1'))

    expect(eventReadRepo.getEventsStats).toHaveBeenCalledWith(filters, scope)
  })
})
