import { GetActiveDeliveriesHandler } from './get-active-deliveries.handler'
import { GetActiveDeliveriesQuery } from './get-active-deliveries.query'

function buildHandler(rows: { orderId: string; eventName: string; token: string }[]) {
  const readRepo = { findActiveByOrderIds: jest.fn().mockResolvedValue(rows) }
  return {
    handler: new GetActiveDeliveriesHandler(readRepo as never),
    readRepo,
  }
}

describe('GetActiveDeliveriesHandler', () => {
  it('returns the live delivery links for the given orders', async () => {
    const { handler } = buildHandler([
      { orderId: 'order-1', eventName: 'Vuelta al Cotopaxi', token: 'tok-1' },
    ])

    const result = await handler.execute(new GetActiveDeliveriesQuery(['order-1']))

    expect(result).toEqual([
      {
        orderId: 'order-1',
        eventName: 'Vuelta al Cotopaxi',
        token: 'tok-1',
      },
    ])
  })

  it('returns nothing without touching the repository when asked for no orders', async () => {
    const { handler, readRepo } = buildHandler([])

    const result = await handler.execute(new GetActiveDeliveriesQuery([]))

    expect(result).toEqual([])
    expect(readRepo.findActiveByOrderIds).not.toHaveBeenCalled()
  })
})
