import type { IOrderReadRepository } from '@orders/domain/ports'
import { EventScope } from '@shared/authorization/domain/event-scope.vo'
import type { IAuthorizationService } from '@shared/authorization/domain/ports/authorization.service.port'
import { GetOrdersStatsHandler } from './get-orders-stats.handler'
import { GetOrdersStatsQuery } from './get-orders-stats.query'

describe('GetOrdersStatsHandler', () => {
  let readRepo: jest.Mocked<Pick<IOrderReadRepository, 'countByStatus' | 'sumRevenue'>>
  let authz: jest.Mocked<Pick<IAuthorizationService, 'resolveEventScope'>>
  let handler: GetOrdersStatsHandler

  beforeEach(() => {
    readRepo = { countByStatus: jest.fn(), sumRevenue: jest.fn() }
    authz = { resolveEventScope: jest.fn() }
    handler = new GetOrdersStatsHandler(readRepo as never, authz as never)
  })

  it('returns counts plus totalRevenue from the repository', async () => {
    const scope = EventScope.unrestricted()
    authz.resolveEventScope.mockResolvedValue(scope)
    readRepo.countByStatus.mockResolvedValue({
      pending: 1,
      payment_info_sent: 2,
      paid: 3,
      delivered: 4,
      gifted: 5,
      cancelled: 6,
    })
    readRepo.sumRevenue.mockResolvedValue('1234.50')

    const result = await handler.execute(new GetOrdersStatsQuery(undefined, 'u1'))

    expect(result.totalRevenue).toBe('1234.50')
    expect(result.paidCount).toBe(7)
    expect(result.totalOrders).toBe(21)
  })

  it('scopes revenue to the given eventId and the caller scope (closes the same class of leak as /events/stats — Ruling 20)', async () => {
    const tenantScope = new EventScope(false, ['tenant-a'], [])
    authz.resolveEventScope.mockResolvedValue(tenantScope)
    readRepo.countByStatus.mockResolvedValue({})
    readRepo.sumRevenue.mockResolvedValue('0')

    const result = await handler.execute(new GetOrdersStatsQuery('event-1', 'u1'))

    expect(authz.resolveEventScope).toHaveBeenCalledWith('u1')
    expect(readRepo.sumRevenue).toHaveBeenCalledWith('event-1', tenantScope)
    expect(readRepo.countByStatus).toHaveBeenCalledWith('event-1', tenantScope)
    expect(result.totalRevenue).toBe('0')
  })
})
