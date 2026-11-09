import { CreateDeliveryLinkCommand } from './create-delivery-link.command'
import { CreateDeliveryLinkHandler } from './create-delivery-link.handler'

function buildHandler() {
  const writeRepo = {
    replaceForOrder: jest.fn().mockImplementation((link) => link),
    save: jest.fn(),
  }
  const config = { getOrThrow: () => 'https://titan.tv/delivery' }
  const handler = new CreateDeliveryLinkHandler(writeRepo as never, config as never)
  return { handler, writeRepo }
}

describe('CreateDeliveryLinkHandler', () => {
  it('replaces the order link instead of inserting a second one, which order_id unique rejects', async () => {
    const { handler, writeRepo } = buildHandler()

    await handler.execute(new CreateDeliveryLinkCommand('order-1'))

    expect(writeRepo.replaceForOrder).toHaveBeenCalledTimes(1)
    expect(writeRepo.replaceForOrder.mock.calls[0][0].orderId).toBe('order-1')
  })

  it('returns the delivery url built from the persisted token', async () => {
    const { handler } = buildHandler()

    const result = await handler.execute(new CreateDeliveryLinkCommand('order-1'))

    expect(result.deliveryUrl).toBe(`https://titan.tv/delivery/${result.token}`)
  })
})
