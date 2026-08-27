import { Order } from '@orders/domain/entities'
import { OrderStatus } from '@orders/domain/value-objects/order-status.vo'
import { PaymentMethod } from '@orders/domain/value-objects/payment-method.vo'
import { CheckoutCartCommand } from './checkout-cart.command'
import { CheckoutCartHandler } from './checkout-cart.handler'

const BUYER = 'buyer-1'
const EVENT = 'event-1'
const CART_ID = 'cart-1'

function buildExistingDraft(): Order {
  const order = Order.createDraft({
    previewLinkId: null,
    eventId: EVENT,
    userId: BUYER,
    notes: null,
    bibNumber: 'OLD-42',
    subtotal: 3,
    snapCurrency: 'USD',
    snapPricingConfig: [{ minQty: 1, maxQty: 2, pricePerPhoto: 3 }],
    paymentMethod: PaymentMethod.CARD,
  })

  return Object.assign(order, { id: 'draft-1' })
}

const OTHER_EVENT = 'event-2'

const DEFAULT_CART_EVENTS = [
  { eventId: EVENT, eventName: 'Event One', eventTypeId: 1, photoIds: ['photo-1'] },
]

const TWO_EVENT_CART = [
  { eventId: EVENT, eventName: 'Event One', eventTypeId: 1, photoIds: ['photo-1', 'photo-2'] },
  { eventId: OTHER_EVENT, eventName: 'Event Two', eventTypeId: 1, photoIds: ['photo-3'] },
]

function buildHandler(
  options: {
    openDraft?: Order | null
    cartEvents?: typeof DEFAULT_CART_EVENTS
    remainingItemCount?: number
  } = {},
) {
  const savedOrders: Order[] = []
  const notifications = { emitOrderCreated: jest.fn() }

  const cartReadRepo = {
    findActiveByUserId: jest.fn(() =>
      Promise.resolve({ id: CART_ID, userId: BUYER, sessionId: null }),
    ),
    getCartItemsByEvent: jest.fn(() => Promise.resolve(options.cartEvents ?? DEFAULT_CART_EVENTS)),
    getCartSummary: jest.fn(() =>
      Promise.resolve({ itemCount: options.remainingItemCount ?? 0, eventCount: 0 }),
    ),
  }

  const cartWriteRepo = {
    markConverted: jest.fn(() => Promise.resolve()),
    removeItems: jest.fn(() => Promise.resolve()),
  }

  const replaceItems = jest.fn((_orderId: string, _items: unknown[]) => Promise.resolve())
  const fakeTx = { fakeTx: true }

  const lockAndUpsertDraft = jest.fn(
    async (
      _userId: string,
      _eventId: string,
      build: (existing: Order | null, tx: unknown) => Promise<{ order: Order; items: unknown[] }>,
    ) => {
      const existing = options.openDraft ?? null
      const { order, items } = await build(existing, fakeTx)
      await replaceItems(order.id, items)
      savedOrders.push(order)
      return order
    },
  )

  const orderWriteRepo = { replaceItems, lockAndUpsertDraft }

  const authUserRepo = {
    getUserSnapData: jest.fn(() =>
      Promise.resolve({
        firstName: 'Jane',
        lastName: 'Doe',
        email: 'jane@example.com',
        phone: null,
        countryId: 1,
        provinceId: null,
        cantonId: null,
      }),
    ),
  }

  const transactionWriteRepo = {
    expireOpenByOrderId: jest.fn((_orderId: string, _tx?: unknown) => Promise.resolve()),
  }

  const handler = new CheckoutCartHandler(
    cartReadRepo as never,
    cartWriteRepo as never,
    orderWriteRepo as never,
    authUserRepo as never,
    transactionWriteRepo as never,
    notifications as never,
  )

  return {
    handler,
    savedOrders,
    notifications,
    cartReadRepo,
    cartWriteRepo,
    orderWriteRepo,
    transactionWriteRepo,
    fakeTx,
  }
}

describe('CheckoutCartHandler', () => {
  it('creates pending orders and notifies the operator when the buyer picks transfer', async () => {
    const { handler, savedOrders, notifications } = buildHandler()

    await handler.execute(
      new CheckoutCartCommand(
        BUYER,
        [{ eventId: EVENT, bibNumber: null, snapCategoryName: null }],
        'transfer',
      ),
    )

    expect(savedOrders[0].status).toBe(OrderStatus.PENDING)
    expect(savedOrders[0].paymentMethod).toBe('transfer')
    expect(notifications.emitOrderCreated).toHaveBeenCalledTimes(1)
  })

  it('marks the cart converted when the buyer picks transfer', async () => {
    const { handler, cartWriteRepo } = buildHandler()

    await handler.execute(
      new CheckoutCartCommand(
        BUYER,
        [{ eventId: EVENT, bibNumber: null, snapCategoryName: null }],
        'transfer',
      ),
    )

    expect(cartWriteRepo.markConverted).toHaveBeenCalledWith(CART_ID)
  })

  it('creates a draft and stays silent when the buyer picks card', async () => {
    const { handler, savedOrders, notifications } = buildHandler()

    await handler.execute(
      new CheckoutCartCommand(
        BUYER,
        [{ eventId: EVENT, bibNumber: null, snapCategoryName: null }],
        'card',
      ),
    )

    expect(savedOrders[0].status).toBe(OrderStatus.DRAFT)
    expect(savedOrders[0].paymentMethod).toBe('card')
    expect(notifications.emitOrderCreated).not.toHaveBeenCalled()
  })

  it('leaves the cart alone when the buyer picks card, so a closed modal or a reload keeps the photos', async () => {
    const { handler, cartWriteRepo } = buildHandler()

    await handler.execute(
      new CheckoutCartCommand(
        BUYER,
        [{ eventId: EVENT, bibNumber: null, snapCategoryName: null }],
        'card',
      ),
    )

    expect(cartWriteRepo.markConverted).not.toHaveBeenCalled()
  })

  it('reuses the buyer open draft for the event, rewriting it to match the new cart and request', async () => {
    const existing = buildExistingDraft()
    const { handler, savedOrders, orderWriteRepo } = buildHandler({ openDraft: existing })

    await handler.execute(
      new CheckoutCartCommand(
        BUYER,
        [{ eventId: EVENT, bibNumber: 'NEW-7', snapCategoryName: null }],
        'card',
      ),
    )

    expect(savedOrders).toHaveLength(1)
    expect(savedOrders[0].id).toBe(existing.id)
    expect(savedOrders[0].subtotal).toBe(4)
    expect(savedOrders[0].bibNumber).toBe('NEW-7')
    expect(orderWriteRepo.replaceItems).toHaveBeenCalledWith(existing.id, [
      { photoId: 'photo-1', unitPrice: 4 },
    ])
  })

  it('expires the open transactions of a draft before its items are replaced, so a stale amount can never be charged', async () => {
    const existing = buildExistingDraft()
    const { handler, orderWriteRepo, transactionWriteRepo, fakeTx } = buildHandler({
      openDraft: existing,
    })

    await handler.execute(
      new CheckoutCartCommand(
        BUYER,
        [{ eventId: EVENT, bibNumber: null, snapCategoryName: null }],
        'card',
      ),
    )

    expect(transactionWriteRepo.expireOpenByOrderId).toHaveBeenCalledWith(existing.id, fakeTx)
    expect(transactionWriteRepo.expireOpenByOrderId.mock.invocationCallOrder[0]).toBeLessThan(
      orderWriteRepo.replaceItems.mock.invocationCallOrder[0],
    )
  })

  it('promotes an open draft to pending and notifies when the buyer switches to transfer', async () => {
    const existing = buildExistingDraft()
    const { handler, savedOrders, notifications, transactionWriteRepo, fakeTx } = buildHandler({
      openDraft: existing,
    })

    await handler.execute(
      new CheckoutCartCommand(
        BUYER,
        [{ eventId: EVENT, bibNumber: null, snapCategoryName: null }],
        'transfer',
      ),
    )

    expect(savedOrders).toHaveLength(1)
    expect(savedOrders[0].id).toBe(existing.id)
    expect(savedOrders[0].status).toBe(OrderStatus.PENDING)
    expect(savedOrders[0].paymentMethod).toBe('transfer')
    expect(transactionWriteRepo.expireOpenByOrderId).toHaveBeenCalledWith(existing.id, fakeTx)
    expect(notifications.emitOrderCreated).toHaveBeenCalledTimes(1)
  })

  it('runs the expiry inside the same transaction the draft rewrite uses', async () => {
    const existing = buildExistingDraft()
    const { handler, transactionWriteRepo, fakeTx } = buildHandler({ openDraft: existing })

    await handler.execute(
      new CheckoutCartCommand(
        BUYER,
        [{ eventId: EVENT, bibNumber: null, snapCategoryName: null }],
        'card',
      ),
    )

    expect(transactionWriteRepo.expireOpenByOrderId.mock.calls[0][1]).toBe(fakeTx)
  })

  it('rejects a checkout that spans more than one event', async () => {
    const { handler } = buildHandler()

    await expect(
      handler.execute(
        new CheckoutCartCommand(
          BUYER,
          [
            { eventId: EVENT, bibNumber: null, snapCategoryName: null },
            { eventId: 'event-2', bibNumber: null, snapCategoryName: null },
          ],
          PaymentMethod.CARD,
        ),
      ),
    ).rejects.toMatchObject({ messageKey: 'cart.single_event_only' })
  })

  it('leaves the other events in the cart when a transfer checkout covers one of them', async () => {
    const { handler, cartWriteRepo } = buildHandler({
      cartEvents: TWO_EVENT_CART,
      remainingItemCount: 1,
    })

    await handler.execute(
      new CheckoutCartCommand(
        BUYER,
        [{ eventId: EVENT, bibNumber: null, snapCategoryName: null }],
        PaymentMethod.TRANSFER,
      ),
    )

    expect(cartWriteRepo.removeItems).toHaveBeenCalledWith(CART_ID, ['photo-1', 'photo-2'])
    expect(cartWriteRepo.markConverted).not.toHaveBeenCalled()
  })

  it('converts the cart when the transfer checkout empties it', async () => {
    const { handler, cartWriteRepo } = buildHandler({ remainingItemCount: 0 })

    await handler.execute(
      new CheckoutCartCommand(
        BUYER,
        [{ eventId: EVENT, bibNumber: null, snapCategoryName: null }],
        PaymentMethod.TRANSFER,
      ),
    )

    expect(cartWriteRepo.removeItems).toHaveBeenCalledWith(CART_ID, ['photo-1'])
    expect(cartWriteRepo.markConverted).toHaveBeenCalledWith(CART_ID)
  })
})
