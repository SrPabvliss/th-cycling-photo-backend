import type { OrdersStatsProjection } from '@orders/application/projections'
import type { IOrderReadRepository } from '@orders/domain/ports'
import { EventScope } from '@shared/authorization/domain/event-scope.vo'
import type { IAuthorizationService } from '@shared/authorization/domain/ports/authorization.service.port'
import { GetOrdersStatsHandler } from './get-orders-stats.handler'
import { GetOrdersStatsQuery } from './get-orders-stats.query'

function buildStats(overrides: Partial<OrdersStatsProjection> = {}): OrdersStatsProjection {
  return {
    totalOrders: 0,
    activeOrders: 0,
    pendingCount: 0,
    paymentInfoSentCount: 0,
    paidCount: 0,
    deliveredCount: 0,
    giftedCount: 0,
    cancelledCount: 0,
    totalRevenue: '0.00',
    openCount: 0,
    openAmount: '0.00',
    awaitingDeliveryCount: 0,
    tabs: {
      all: 0,
      pending: 0,
      paymentInfoSent: 0,
      paid: 0,
      delivered: 0,
      gifted: 0,
      cancelled: 0,
    },
    ...overrides,
  }
}

describe('GetOrdersStatsHandler', () => {
  let readRepo: jest.Mocked<Pick<IOrderReadRepository, 'getStats'>>
  let authz: jest.Mocked<Pick<IAuthorizationService, 'resolveEventScope'>>
  let handler: GetOrdersStatsHandler

  beforeEach(() => {
    readRepo = { getStats: jest.fn() }
    authz = { resolveEventScope: jest.fn() }
    handler = new GetOrdersStatsHandler(readRepo as never, authz as never)
  })

  it('returns whatever the repository projects', async () => {
    const scope = EventScope.unrestricted()
    authz.resolveEventScope.mockResolvedValue(scope)
    const stats = buildStats({ totalRevenue: '1234.50', paidCount: 7, totalOrders: 21 })
    readRepo.getStats.mockResolvedValue(stats)

    const result = await handler.execute(new GetOrdersStatsQuery(undefined, 'u1'))

    expect(result).toBe(stats)
  })

  it('scopes stats to the caller and passes the eventId and search through, never the status (closes the same class of leak as /events/stats — Ruling 20)', async () => {
    const tenantScope = new EventScope(false, ['tenant-a'], [])
    authz.resolveEventScope.mockResolvedValue(tenantScope)
    readRepo.getStats.mockResolvedValue(buildStats())

    await handler.execute(new GetOrdersStatsQuery('event-1', 'u1', 'andrea'))

    expect(authz.resolveEventScope).toHaveBeenCalledWith('u1')
    expect(readRepo.getStats).toHaveBeenCalledWith(
      { eventId: 'event-1', search: 'andrea' },
      tenantScope,
    )
  })
})
