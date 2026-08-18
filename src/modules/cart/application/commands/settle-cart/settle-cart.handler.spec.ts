import { SettleCartCommand } from './settle-cart.command'
import { SettleCartHandler } from './settle-cart.handler'

const BUYER = 'buyer-1'
const CART_ID = 'cart-1'

function buildHandler(options: { activeCart?: { id: string } | null; itemCount?: number } = {}) {
  let activeCart = options.activeCart === undefined ? { id: CART_ID } : options.activeCart
  const remainingItemCount = options.itemCount ?? 0

  const cartReadRepo = {
    findActiveByUserId: jest.fn(() => Promise.resolve(activeCart)),
    getCartSummary: jest.fn(() =>
      Promise.resolve({
        itemCount: remainingItemCount,
        eventCount: remainingItemCount > 0 ? 1 : 0,
      }),
    ),
  }

  const cartWriteRepo = {
    removeItems: jest.fn(() => Promise.resolve()),
    markConverted: jest.fn(() => {
      activeCart = null
      return Promise.resolve()
    }),
  }

  const orderReadRepo = {
    getPhotoIdsByOrderIds: jest.fn(() => Promise.resolve(['photo-1', 'photo-2'])),
  }

  const handler = new SettleCartHandler(
    cartReadRepo as never,
    cartWriteRepo as never,
    orderReadRepo as never,
  )

  return { handler, cartReadRepo, cartWriteRepo, orderReadRepo }
}

describe('SettleCartHandler', () => {
  it('removes exactly the photos paid for from the buyer active cart', async () => {
    const { handler, cartWriteRepo, orderReadRepo } = buildHandler()

    await handler.execute(new SettleCartCommand(BUYER, ['order-1']))

    expect(orderReadRepo.getPhotoIdsByOrderIds).toHaveBeenCalledWith(['order-1'])
    expect(cartWriteRepo.removeItems).toHaveBeenCalledWith(CART_ID, ['photo-1', 'photo-2'])
  })

  it('converts the cart when nothing is left in it', async () => {
    const { handler, cartWriteRepo } = buildHandler({ itemCount: 0 })

    await handler.execute(new SettleCartCommand(BUYER, ['order-1']))

    expect(cartWriteRepo.markConverted).toHaveBeenCalledWith(CART_ID)
  })

  it('keeps the cart open when photos added mid-flow are still in it', async () => {
    const { handler, cartWriteRepo } = buildHandler({ itemCount: 1 })

    await handler.execute(new SettleCartCommand(BUYER, ['order-1']))

    expect(cartWriteRepo.markConverted).not.toHaveBeenCalled()
  })

  it('does nothing when the buyer has no active cart', async () => {
    const { handler, cartWriteRepo, orderReadRepo } = buildHandler({ activeCart: null })

    await handler.execute(new SettleCartCommand(BUYER, ['order-1']))

    expect(orderReadRepo.getPhotoIdsByOrderIds).not.toHaveBeenCalled()
    expect(cartWriteRepo.removeItems).not.toHaveBeenCalled()
    expect(cartWriteRepo.markConverted).not.toHaveBeenCalled()
  })

  it('is a harmless no-op on a second, replayed settlement once the cart has already converted', async () => {
    const { handler, cartReadRepo, cartWriteRepo } = buildHandler({ itemCount: 0 })

    await handler.execute(new SettleCartCommand(BUYER, ['order-1']))
    cartWriteRepo.removeItems.mockClear()
    cartWriteRepo.markConverted.mockClear()

    await handler.execute(new SettleCartCommand(BUYER, ['order-1']))

    expect(cartReadRepo.findActiveByUserId).toHaveBeenCalledTimes(2)
    expect(cartWriteRepo.removeItems).not.toHaveBeenCalled()
    expect(cartWriteRepo.markConverted).not.toHaveBeenCalled()
  })
})
