import { AuditContext } from '@shared/application'
import { AppException } from '@shared/domain'
import { Order } from '../../../domain/entities'
import { ConvertOrderToGiftCommand } from './convert-order-to-gift.command'
import { ConvertOrderToGiftHandler } from './convert-order-to-gift.handler'

describe('ConvertOrderToGiftHandler', () => {
  const audit = new AuditContext('admin-1')

  function buildPaidOrder(): Order {
    const order = Order.create({
      previewLinkId: null,
      eventId: 'event-1',
      userId: 'user-1',
      notes: null,
    })
    order.confirmPayment('admin-0')
    return order
  }

  it('throws when the order does not exist', async () => {
    const readRepo = { findById: jest.fn().mockResolvedValue(null) }
    const writeRepo = { save: jest.fn() }
    const handler = new ConvertOrderToGiftHandler(writeRepo as never, readRepo as never)

    await expect(handler.execute(new ConvertOrderToGiftCommand('missing', audit))).rejects.toThrow(
      AppException,
    )
    expect(writeRepo.save).not.toHaveBeenCalled()
  })

  it('converts the order and saves it', async () => {
    const order = buildPaidOrder()
    const readRepo = { findById: jest.fn().mockResolvedValue(order) }
    const writeRepo = { save: jest.fn().mockResolvedValue(order) }
    const handler = new ConvertOrderToGiftHandler(writeRepo as never, readRepo as never)

    const result = await handler.execute(new ConvertOrderToGiftCommand(order.id, audit))

    expect(order.status).toBe('gifted')
    expect(order.paidAt).toBeNull()
    expect(writeRepo.save).toHaveBeenCalledWith(order)
    expect(result).toEqual({ id: order.id })
  })
})
