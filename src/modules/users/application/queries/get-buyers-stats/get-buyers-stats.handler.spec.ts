import type { IUserReadRepository } from '@users/domain/ports'
import { GetBuyersStatsHandler } from './get-buyers-stats.handler'
import { GetBuyersStatsQuery } from './get-buyers-stats.query'

describe('GetBuyersStatsHandler', () => {
  let handler: GetBuyersStatsHandler
  let readRepo: jest.Mocked<Pick<IUserReadRepository, 'getBuyersStats'>>

  const emptyStats = {
    totalBuyers: 0,
    boughtCount: 0,
    boughtPercent: 0,
    recurrentCount: 0,
    newLast30Days: 0,
    averageTicket: '0.00',
    tabs: { all: 0, bought: 0, never: 0, recurrent: 0 },
  }

  beforeEach(() => {
    readRepo = { getBuyersStats: jest.fn().mockResolvedValue(emptyStats) }
    handler = new GetBuyersStatsHandler(readRepo as never)
  })

  it('passes every filter through to the repository unchanged', async () => {
    const filters = {
      search: 'ana',
      purchase: 'bought' as const,
      countryId: 1,
      provinceId: 2,
      registeredFrom: new Date('2026-01-01'),
      registeredTo: new Date('2026-02-01'),
      gender: 'female',
      ageFrom: 18,
      ageTo: 40,
      emailVerified: true,
      hasWhatsapp: true,
    }

    await handler.execute(new GetBuyersStatsQuery(filters))

    expect(readRepo.getBuyersStats).toHaveBeenCalledWith(filters)
  })

  it('defaults purchase to "all" when omitted', async () => {
    await handler.execute(new GetBuyersStatsQuery({}))

    expect(readRepo.getBuyersStats).toHaveBeenCalledWith({ purchase: 'all' })
  })
})
