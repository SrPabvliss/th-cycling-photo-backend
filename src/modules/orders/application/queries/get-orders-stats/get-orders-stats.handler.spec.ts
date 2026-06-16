import { GetOrdersStatsHandler } from './get-orders-stats.handler'
import { GetOrdersStatsQuery } from './get-orders-stats.query'

describe('GetOrdersStatsHandler', () => {
  let readRepo: { countByStatus: jest.Mock; sumRevenue: jest.Mock }
  let handler: GetOrdersStatsHandler

  beforeEach(() => {
    readRepo = { countByStatus: jest.fn(), sumRevenue: jest.fn() }
    handler = new GetOrdersStatsHandler(readRepo as never)
  })

  it('returns counts plus totalRevenue from the repository', async () => {
    readRepo.countByStatus.mockResolvedValue({
      pending: 1,
      payment_info_sent: 2,
      paid: 3,
      delivered: 4,
      gifted: 5,
      cancelled: 6,
    })
    readRepo.sumRevenue.mockResolvedValue('1234.50')

    const result = await handler.execute(new GetOrdersStatsQuery(undefined))

    expect(result.totalRevenue).toBe('1234.50')
    expect(result.paidCount).toBe(7)
    expect(result.totalOrders).toBe(21)
  })

  it('scopes revenue to the given eventId', async () => {
    readRepo.countByStatus.mockResolvedValue({})
    readRepo.sumRevenue.mockResolvedValue('0')

    const result = await handler.execute(new GetOrdersStatsQuery('event-1'))

    expect(readRepo.sumRevenue).toHaveBeenCalledWith('event-1')
    expect(readRepo.countByStatus).toHaveBeenCalledWith('event-1')
    expect(result.totalRevenue).toBe('0')
  })
})
