import type { IOrderWriteRepository } from '@orders/domain/ports'
import { OrderStatus } from '@orders/domain/value-objects/order-status.vo'
import { CancelMyOrderCommand } from './cancel-my-order.command'
import { CancelMyOrderHandler } from './cancel-my-order.handler'

describe('CancelMyOrderHandler', () => {
  const USER_ID = 'user-1'
  const ORDER_ID = 'order-1'
  const fakeTx = { fakeTx: true }

  let handler: CancelMyOrderHandler
  let writeRepo: jest.Mocked<IOrderWriteRepository>
  let prisma: { $transaction: jest.Mock }
  let readRepo: { getDetail: jest.Mock }
  let notifications: { emitOrderCancelledByBuyer: jest.Mock }
  let order: {
    id: string
    userId: string
    status: string
    isPaid: boolean
    cancelByOwner: jest.Mock
  }

  beforeEach(() => {
    order = {
      id: ORDER_ID,
      userId: USER_ID,
      status: OrderStatus.PENDING,
      isPaid: false,
      cancelByOwner: jest.fn(),
    }

    writeRepo = {
      findByIdForUpdate: jest.fn().mockResolvedValue(order),
      findPaymentsForUpdate: jest.fn().mockResolvedValue({ statuses: [], beingConfirmed: false }),
      save: jest.fn(),
    } as unknown as jest.Mocked<IOrderWriteRepository>

    prisma = { $transaction: jest.fn(async (work: (tx: unknown) => unknown) => work(fakeTx)) }

    readRepo = {
      getDetail: jest.fn().mockResolvedValue({
        eventId: 'event-1',
        eventName: 'Downhill',
        userName: 'Ana Rider',
        photos: [{}, {}],
        subtotal: '8.00',
        snapCurrency: 'USD',
      }),
    }
    notifications = { emitOrderCancelledByBuyer: jest.fn() }

    handler = new CancelMyOrderHandler(
      writeRepo,
      prisma as never,
      readRepo as never,
      notifications as never,
    )
  })

  it('tells staff once committed when the payment details had already been sent', async () => {
    order.status = OrderStatus.PAYMENT_INFO_SENT

    await handler.execute(new CancelMyOrderCommand(USER_ID, ORDER_ID))

    expect(notifications.emitOrderCancelledByBuyer).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: ORDER_ID,
        eventId: 'event-1',
        customerName: 'Ana Rider',
        photoCount: 2,
        subtotal: 8,
        actorUserId: USER_ID,
      }),
    )
  })

  it('tells no one when the order was still waiting for the payment details', async () => {
    await handler.execute(new CancelMyOrderCommand(USER_ID, ORDER_ID))

    expect(notifications.emitOrderCancelledByBuyer).not.toHaveBeenCalled()
  })

  it('keeps the cancellation when staff cannot be told', async () => {
    order.status = OrderStatus.PAYMENT_INFO_SENT
    readRepo.getDetail.mockRejectedValue(new Error('db down'))

    await expect(handler.execute(new CancelMyOrderCommand(USER_ID, ORDER_ID))).resolves.toEqual({
      id: ORDER_ID,
    })
    expect(writeRepo.save).toHaveBeenCalled()
  })

  it('cancels an order that belongs to the caller, reading and saving it under its lock', async () => {
    const result = await handler.execute(new CancelMyOrderCommand(USER_ID, ORDER_ID))

    expect(writeRepo.findByIdForUpdate).toHaveBeenCalledWith(ORDER_ID, fakeTx)
    expect(writeRepo.findPaymentsForUpdate).toHaveBeenCalledWith(ORDER_ID, fakeTx)
    expect(order.cancelByOwner).toHaveBeenCalled()
    expect(writeRepo.save).toHaveBeenCalledWith(order, fakeTx)
    expect(result).toEqual({ id: ORDER_ID })
  })

  it('rejects an order belonging to someone else as not found', async () => {
    order.userId = 'other-user'

    await expect(
      handler.execute(new CancelMyOrderCommand(USER_ID, ORDER_ID)),
    ).rejects.toMatchObject({
      messageKey: 'errors.NOT_FOUND',
      context: { entity: 'entities.order' },
    })
    expect(writeRepo.save).not.toHaveBeenCalled()
  })

  it('rejects a missing order as not found', async () => {
    writeRepo.findByIdForUpdate.mockResolvedValue(null)

    await expect(
      handler.execute(new CancelMyOrderCommand(USER_ID, ORDER_ID)),
    ).rejects.toMatchObject({ messageKey: 'errors.NOT_FOUND' })
    expect(writeRepo.save).not.toHaveBeenCalled()
  })

  it.each([
    ['initiated'],
    ['confirming'],
  ])('refuses to cancel while a card payment is %s', async (status) => {
    writeRepo.findPaymentsForUpdate.mockResolvedValue({ statuses: [status], beingConfirmed: false })

    await expect(
      handler.execute(new CancelMyOrderCommand(USER_ID, ORDER_ID)),
    ).rejects.toMatchObject({ messageKey: 'order.payment_in_progress' })
    expect(order.cancelByOwner).not.toHaveBeenCalled()
    expect(writeRepo.save).not.toHaveBeenCalled()
  })

  it('refuses to cancel once the gateway approved the charge but the order is not paid yet', async () => {
    writeRepo.findPaymentsForUpdate.mockResolvedValue({
      statuses: ['approved'],
      beingConfirmed: false,
    })

    await expect(
      handler.execute(new CancelMyOrderCommand(USER_ID, ORDER_ID)),
    ).rejects.toMatchObject({ messageKey: 'order.payment_in_progress' })
    expect(writeRepo.save).not.toHaveBeenCalled()
  })

  it('lets the order rules decide once every payment ended without a charge', async () => {
    writeRepo.findPaymentsForUpdate.mockResolvedValue({
      statuses: ['declined', 'expired'],
      beingConfirmed: false,
    })

    await handler.execute(new CancelMyOrderCommand(USER_ID, ORDER_ID))

    expect(order.cancelByOwner).toHaveBeenCalled()
  })

  it('refuses at once while a confirmation holds one of its card payments', async () => {
    writeRepo.findPaymentsForUpdate.mockResolvedValue({ statuses: [], beingConfirmed: true })

    await expect(
      handler.execute(new CancelMyOrderCommand(USER_ID, ORDER_ID)),
    ).rejects.toMatchObject({ messageKey: 'order.payment_in_progress' })
    expect(order.cancelByOwner).not.toHaveBeenCalled()
    expect(writeRepo.save).not.toHaveBeenCalled()
  })
})
