import { SettleCartCommand } from '@cart/application/commands'
import { SettleCartHandler } from '@cart/application/commands/settle-cart/settle-cart.handler'
import { Logger } from '@nestjs/common'
import { Order } from '@orders/domain/entities'
import { OrderStatus } from '@orders/domain/value-objects/order-status.vo'
import { PaymentMethod } from '@orders/domain/value-objects/payment-method.vo'
import { ChoosePaymentMethodCommand } from './choose-payment-method.command'
import { ChoosePaymentMethodHandler } from './choose-payment-method.handler'

const BUYER = 'buyer-1'

function buildOrder(id: string, userId: string): Order {
  const order = Order.create({
    previewLinkId: null,
    eventId: 'event-1',
    userId,
    notes: null,
    subtotal: 10,
  })

  return Object.assign(order, { id })
}

function buildDraftOrder(id: string, userId: string): Order {
  const order = Order.createDraft({
    previewLinkId: null,
    eventId: 'event-1',
    userId,
    notes: null,
    subtotal: 10,
  })

  return Object.assign(order, { id })
}

interface CartLine {
  photoId: string
  eventId: string
  removed: boolean
}

/**
 * The buyer's cart, kept in memory and reached the way production reaches it: through the
 * command bus and the real `SettleCartHandler`, so the test sees what that operation does to it.
 */
function buildCart(
  lines: Array<Omit<CartLine, 'removed'>>,
  photosByOrder: Record<string, string[]>,
  status: 'active' | 'converted' = 'active',
) {
  const cart = {
    id: 'cart-1',
    userId: BUYER,
    status,
    lines: lines.map((line) => ({ ...line, removed: false })),
  }
  const live = () => cart.lines.filter((line) => !line.removed)

  const cartReadRepo = {
    findActiveByUserId: jest.fn(async (userId: string) =>
      userId === cart.userId && cart.status === 'active' ? { id: cart.id } : null,
    ),
    getCartSummary: jest.fn(async () => ({
      itemCount: live().length,
      eventCount: new Set(live().map((line) => line.eventId)).size,
    })),
  }
  const cartWriteRepo = {
    removeItems: jest.fn(async (_cartId: string, photoIds: string[]) => {
      cart.lines
        .filter((line) => photoIds.includes(line.photoId))
        .forEach((line) => {
          line.removed = true
        })
    }),
    markConverted: jest.fn(async () => {
      cart.status = 'converted'
    }),
  }
  const orderReadRepo = {
    getPhotoIdsByOrderIds: jest.fn(async (orderIds: string[]) =>
      orderIds.flatMap((orderId) => photosByOrder[orderId] ?? []),
    ),
  }

  const settleCart = new SettleCartHandler(
    cartReadRepo as never,
    cartWriteRepo as never,
    orderReadRepo as never,
  )
  const commandBus = {
    execute: jest.fn(async (command: unknown) => {
      if (command instanceof SettleCartCommand) return settleCart.execute(command)
      throw new Error(`Unexpected command ${String(command)}`)
    }),
  }

  return {
    commandBus,
    cartWriteRepo,
    photosInCart: () => live().map((line) => line.photoId),
    status: () => cart.status,
  }
}

function buildHandler(orders: Order[], acceptsCard = true, cart = buildCart([], {})) {
  const saved: Order[] = []
  const readRepo = {
    findById: jest.fn((id: string) => Promise.resolve(orders.find((o) => o.id === id) ?? null)),
    getDetail: jest.fn((id: string) =>
      Promise.resolve({
        eventId: 'event-1',
        eventName: 'Vuelta al Valle',
        userName: 'Juan Perez',
        subtotal: '10',
        snapCurrency: 'USD',
        photos: [{ id: `${id}-photo-1` }],
      }),
    ),
  }
  const writeRepo = {
    save: jest.fn((order: Order) => {
      saved.push(order)
      return Promise.resolve(order)
    }),
  }
  const transactionWriteRepo = {
    expireOpenByOrderId: jest.fn().mockResolvedValue(undefined),
  }
  const notifications = {
    emitOrderCreated: jest.fn(),
  }

  const receiverResolver = {
    acceptsCard: jest.fn().mockResolvedValue(acceptsCard),
  }

  return {
    handler: new ChoosePaymentMethodHandler(
      writeRepo as never,
      readRepo as never,
      transactionWriteRepo as never,
      notifications as never,
      receiverResolver as never,
      cart.commandBus as never,
    ),
    saved,
    readRepo,
    transactionWriteRepo,
    notifications,
    cart,
  }
}

describe('ChoosePaymentMethodHandler', () => {
  it('writes the method on every order of the group', async () => {
    const orders = [buildOrder('order-1', BUYER), buildOrder('order-2', BUYER)]
    const { handler, saved } = buildHandler(orders)

    await handler.execute(
      new ChoosePaymentMethodCommand(['order-1', 'order-2'], PaymentMethod.CARD, BUYER),
    )

    expect(saved.map((order) => order.paymentMethod)).toEqual([
      PaymentMethod.CARD,
      PaymentMethod.CARD,
    ])
  })

  it('refuses a group containing an order that belongs to someone else', async () => {
    const orders = [buildOrder('order-1', BUYER), buildOrder('order-2', 'someone-else')]
    const { handler, saved } = buildHandler(orders)

    await expect(
      handler.execute(
        new ChoosePaymentMethodCommand(['order-1', 'order-2'], PaymentMethod.CARD, BUYER),
      ),
    ).rejects.toThrow()

    expect(saved).toHaveLength(0)
  })

  it('refuses a group containing an order that does not exist', async () => {
    const orders = [buildOrder('order-1', BUYER)]
    const { handler } = buildHandler(orders)

    await expect(
      handler.execute(
        new ChoosePaymentMethodCommand(['order-1', 'ghost'], PaymentMethod.CARD, BUYER),
      ),
    ).rejects.toThrow()
  })

  it('refuses to switch to card when the event has no usable Payphone account', async () => {
    const orders = [buildDraftOrder('order-1', BUYER)]
    const { handler, saved } = buildHandler(orders, false)

    await expect(
      handler.execute(new ChoosePaymentMethodCommand(['order-1'], PaymentMethod.CARD, BUYER)),
    ).rejects.toMatchObject({ messageKey: 'payment.card_unavailable' })
    expect(saved).toHaveLength(0)
  })

  it('promotes a draft to pending when the buyer switches to transfer', async () => {
    const draft = buildDraftOrder('order-1', BUYER)
    const { handler, saved } = buildHandler([draft])

    await handler.execute(
      new ChoosePaymentMethodCommand(['order-1'], PaymentMethod.TRANSFER, BUYER),
    )

    expect(saved[0].status).toBe(OrderStatus.PENDING)
  })

  it('leaves a draft as a draft when the buyer picks card again', async () => {
    const draft = buildDraftOrder('order-1', BUYER)
    const { handler, saved } = buildHandler([draft])

    await handler.execute(new ChoosePaymentMethodCommand(['order-1'], PaymentMethod.CARD, BUYER))

    expect(saved[0].status).toBe(OrderStatus.DRAFT)
  })

  it('notifies the operator when a draft is promoted to pending via transfer', async () => {
    const draft = buildDraftOrder('order-1', BUYER)
    const { handler, notifications } = buildHandler([draft])

    await handler.execute(
      new ChoosePaymentMethodCommand(['order-1'], PaymentMethod.TRANSFER, BUYER),
    )

    expect(notifications.emitOrderCreated).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: 'order-1',
        eventName: 'Vuelta al Valle',
        customerName: 'Juan Perez',
        photoCount: 1,
        subtotal: 10,
        currency: 'USD',
        actorUserId: BUYER,
      }),
    )
  })

  it('does not notify when the buyer picks card again on an already-draft order', async () => {
    const draft = buildDraftOrder('order-1', BUYER)
    const { handler, notifications } = buildHandler([draft])

    await handler.execute(new ChoosePaymentMethodCommand(['order-1'], PaymentMethod.CARD, BUYER))

    expect(notifications.emitOrderCreated).not.toHaveBeenCalled()
  })

  it('does not notify when picking transfer on an order that is not a draft', async () => {
    const order = buildOrder('order-1', BUYER)
    const { handler, notifications } = buildHandler([order])

    await handler.execute(
      new ChoosePaymentMethodCommand(['order-1'], PaymentMethod.TRANSFER, BUYER),
    )

    expect(notifications.emitOrderCreated).not.toHaveBeenCalled()
  })

  it('expires open transactions for every draft it promotes to pending', async () => {
    const draft = buildDraftOrder('order-1', BUYER)
    const { handler, transactionWriteRepo } = buildHandler([draft])

    await handler.execute(
      new ChoosePaymentMethodCommand(['order-1'], PaymentMethod.TRANSFER, BUYER),
    )

    expect(transactionWriteRepo.expireOpenByOrderId).toHaveBeenCalledWith('order-1')
  })

  it('does not touch open transactions when no order is promoted', async () => {
    const draft = buildDraftOrder('order-1', BUYER)
    const { handler, transactionWriteRepo } = buildHandler([draft])

    await handler.execute(new ChoosePaymentMethodCommand(['order-1'], PaymentMethod.CARD, BUYER))

    expect(transactionWriteRepo.expireOpenByOrderId).not.toHaveBeenCalled()
  })

  describe("the buyer's cart when a card order switches to transfer", () => {
    const ORDER_PHOTOS = { 'order-1': ['photo-a', 'photo-b'] }

    it('promotes the order and takes its photos out of the cart, leaving other events alone', async () => {
      const cart = buildCart(
        [
          { photoId: 'photo-a', eventId: 'event-1' },
          { photoId: 'photo-b', eventId: 'event-1' },
          { photoId: 'photo-other', eventId: 'event-2' },
        ],
        ORDER_PHOTOS,
      )
      const { handler, saved } = buildHandler([buildDraftOrder('order-1', BUYER)], true, cart)

      await handler.execute(
        new ChoosePaymentMethodCommand(['order-1'], PaymentMethod.TRANSFER, BUYER),
      )

      expect(saved[0].status).toBe(OrderStatus.PENDING)
      expect(cart.photosInCart()).toEqual(['photo-other'])
      expect(cart.status()).toBe('active')
    })

    it('closes the cart as converted when the order took everything in it, as checkout does', async () => {
      const cart = buildCart(
        [
          { photoId: 'photo-a', eventId: 'event-1' },
          { photoId: 'photo-b', eventId: 'event-1' },
        ],
        ORDER_PHOTOS,
      )
      const { handler } = buildHandler([buildDraftOrder('order-1', BUYER)], true, cart)

      await handler.execute(
        new ChoosePaymentMethodCommand(['order-1'], PaymentMethod.TRANSFER, BUYER),
      )

      expect(cart.photosInCart()).toEqual([])
      expect(cart.status()).toBe('converted')
    })

    it('does not fail when the cart no longer holds those photos', async () => {
      const cart = buildCart([{ photoId: 'photo-other', eventId: 'event-2' }], ORDER_PHOTOS)
      const { handler, saved } = buildHandler([buildDraftOrder('order-1', BUYER)], true, cart)

      await expect(
        handler.execute(new ChoosePaymentMethodCommand(['order-1'], PaymentMethod.TRANSFER, BUYER)),
      ).resolves.toEqual({ orderIds: ['order-1'] })

      expect(saved[0].status).toBe(OrderStatus.PENDING)
      expect(cart.photosInCart()).toEqual(['photo-other'])
      expect(cart.status()).toBe('active')
    })

    it('does not fail when the buyer has no active cart at all', async () => {
      const cart = buildCart([], ORDER_PHOTOS, 'converted')
      const { handler, saved } = buildHandler([buildDraftOrder('order-1', BUYER)], true, cart)

      await expect(
        handler.execute(new ChoosePaymentMethodCommand(['order-1'], PaymentMethod.TRANSFER, BUYER)),
      ).resolves.toEqual({ orderIds: ['order-1'] })
      expect(saved[0].status).toBe(OrderStatus.PENDING)
      expect(cart.cartWriteRepo.removeItems).not.toHaveBeenCalled()
    })

    it.each([
      ['an order that belongs to someone else', 'someone-else', ['order-1']],
      ['an order that does not exist', BUYER, ['order-1', 'ghost']],
    ])('touches no cart when the group holds %s', async (_case, owner, orderIds) => {
      const cart = buildCart([{ photoId: 'photo-a', eventId: 'event-1' }], ORDER_PHOTOS)
      const { handler, saved } = buildHandler([buildDraftOrder('order-1', owner)], true, cart)

      await expect(
        handler.execute(new ChoosePaymentMethodCommand(orderIds, PaymentMethod.TRANSFER, BUYER)),
      ).rejects.toThrow()

      expect(saved).toHaveLength(0)
      expect(cart.commandBus.execute).not.toHaveBeenCalled()
      expect(cart.photosInCart()).toEqual(['photo-a'])
    })

    it('leaves the cart alone when the buyer picks card again', async () => {
      const cart = buildCart([{ photoId: 'photo-a', eventId: 'event-1' }], ORDER_PHOTOS)
      const { handler } = buildHandler([buildDraftOrder('order-1', BUYER)], true, cart)

      await handler.execute(new ChoosePaymentMethodCommand(['order-1'], PaymentMethod.CARD, BUYER))

      expect(cart.commandBus.execute).not.toHaveBeenCalled()
      expect(cart.photosInCart()).toEqual(['photo-a'])
    })

    it('leaves the cart alone when the order was already a transfer order, not a draft', async () => {
      const cart = buildCart([{ photoId: 'photo-a', eventId: 'event-1' }], ORDER_PHOTOS)
      const { handler } = buildHandler([buildOrder('order-1', BUYER)], true, cart)

      await handler.execute(
        new ChoosePaymentMethodCommand(['order-1'], PaymentMethod.TRANSFER, BUYER),
      )

      expect(cart.commandBus.execute).not.toHaveBeenCalled()
    })

    it('settles the cart once, for the drafts it promoted only', async () => {
      const cart = buildCart(
        [
          { photoId: 'photo-a', eventId: 'event-1' },
          { photoId: 'photo-c', eventId: 'event-1' },
        ],
        { 'order-1': ['photo-a'], 'order-2': ['photo-c'] },
      )
      const { handler } = buildHandler(
        [buildDraftOrder('order-1', BUYER), buildOrder('order-2', BUYER)],
        true,
        cart,
      )

      await handler.execute(
        new ChoosePaymentMethodCommand(['order-1', 'order-2'], PaymentMethod.TRANSFER, BUYER),
      )

      expect(cart.commandBus.execute).toHaveBeenCalledTimes(1)
      expect(cart.commandBus.execute).toHaveBeenCalledWith(
        new SettleCartCommand(BUYER, ['order-1']),
      )
      expect(cart.photosInCart()).toEqual(['photo-c'])
    })

    it('keeps the switch when the cart cannot be updated: the order is already pending', async () => {
      const cart = buildCart([{ photoId: 'photo-a', eventId: 'event-1' }], ORDER_PHOTOS)
      cart.cartWriteRepo.removeItems.mockRejectedValueOnce(new Error('database unavailable'))
      const logError = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined)
      const { handler, saved, notifications } = buildHandler(
        [buildDraftOrder('order-1', BUYER)],
        true,
        cart,
      )

      await expect(
        handler.execute(new ChoosePaymentMethodCommand(['order-1'], PaymentMethod.TRANSFER, BUYER)),
      ).resolves.toEqual({ orderIds: ['order-1'] })

      expect(saved[0].status).toBe(OrderStatus.PENDING)
      expect(notifications.emitOrderCreated).toHaveBeenCalledTimes(1)
      expect(logError).toHaveBeenCalledWith(expect.stringContaining('orderIds=order-1'))
      logError.mockRestore()
    })
  })
})
