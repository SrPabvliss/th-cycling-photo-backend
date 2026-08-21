import type { IOrderReadRepository, IOrderWriteRepository } from '@orders/domain/ports'
import { OrderStatus } from '@orders/domain/value-objects/order-status.vo'
import { CancelMyOrderCommand } from './cancel-my-order.command'
import { CancelMyOrderHandler } from './cancel-my-order.handler'

describe('CancelMyOrderHandler', () => {
  const USER_ID = 'user-1'
  const ORDER_ID = 'order-1'

  let handler: CancelMyOrderHandler
  let readRepo: jest.Mocked<IOrderReadRepository>
  let writeRepo: jest.Mocked<IOrderWriteRepository>
  let order: { id: string; userId: string; status: string; cancelByOwner: jest.Mock }

  beforeEach(() => {
    order = { id: ORDER_ID, userId: USER_ID, status: OrderStatus.PENDING, cancelByOwner: jest.fn() }

    readRepo = {
      findById: jest.fn().mockResolvedValue(order),
      hasPaymentInFlight: jest.fn().mockResolvedValue(false),
    } as unknown as jest.Mocked<IOrderReadRepository>

    writeRepo = { save: jest.fn() } as unknown as jest.Mocked<IOrderWriteRepository>

    handler = new CancelMyOrderHandler(readRepo, writeRepo)
  })

  it('cancels an order that belongs to the caller', async () => {
    const result = await handler.execute(new CancelMyOrderCommand(USER_ID, ORDER_ID))

    expect(order.cancelByOwner).toHaveBeenCalled()
    expect(writeRepo.save).toHaveBeenCalledWith(order)
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

  it('refuses to cancel while a payment is in flight', async () => {
    readRepo.hasPaymentInFlight.mockResolvedValue(true)

    await expect(handler.execute(new CancelMyOrderCommand(USER_ID, ORDER_ID))).rejects.toThrow(
      /order\.payment_in_progress/,
    )
    expect(order.cancelByOwner).not.toHaveBeenCalled()
    expect(writeRepo.save).not.toHaveBeenCalled()
  })
})
