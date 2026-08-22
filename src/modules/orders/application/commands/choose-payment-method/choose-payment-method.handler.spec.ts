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

function buildHandler(orders: Order[]) {
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

  return {
    handler: new ChoosePaymentMethodHandler(
      writeRepo as never,
      readRepo as never,
      transactionWriteRepo as never,
      notifications as never,
    ),
    saved,
    readRepo,
    transactionWriteRepo,
    notifications,
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
})
