import type { IOrderReadRepository } from '@orders/domain/ports'
import { GetMyOrdersSummaryHandler } from './get-my-orders-summary.handler'
import { GetMyOrdersSummaryQuery } from './get-my-orders-summary.query'

describe('GetMyOrdersSummaryHandler', () => {
  const USER_ID = 'user-1'

  let handler: GetMyOrdersSummaryHandler
  let readRepo: jest.Mocked<IOrderReadRepository>

  beforeEach(() => {
    readRepo = {
      getMySummary: jest.fn(),
    } as unknown as jest.Mocked<IOrderReadRepository>

    handler = new GetMyOrdersSummaryHandler(readRepo)
  })

  it('groups spend by currency and never counts gifted orders as spend', async () => {
    readRepo.getMySummary.mockResolvedValue({
      orderCount: 5,
      photoCount: 12,
      eventCount: 3,
      spent: [
        { currency: 'USD', amount: '45.50' },
        { currency: 'EUR', amount: '10.00' },
      ],
    })

    const result = await handler.execute(new GetMyOrdersSummaryQuery(USER_ID))

    expect(readRepo.getMySummary).toHaveBeenCalledWith(USER_ID)
    expect(result.spent).toEqual([
      { currency: 'USD', amount: '45.50' },
      { currency: 'EUR', amount: '10.00' },
    ])
  })

  it('returns an empty spend list when the repository reports nothing spent', async () => {
    readRepo.getMySummary.mockResolvedValue({
      orderCount: 2,
      photoCount: 0,
      eventCount: 1,
      spent: [],
    })

    const result = await handler.execute(new GetMyOrdersSummaryQuery(USER_ID))

    expect(result.spent).toEqual([])
  })
})
