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

    handler = new CancelMyOrderHandler(writeRepo, prisma as never)
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
