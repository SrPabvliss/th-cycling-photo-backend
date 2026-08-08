import { AuditContext } from '@shared/application'
import { AppException } from '@shared/domain'
import { Order } from '../../../domain/entities'
import { ConvertOrderToSaleCommand } from './convert-order-to-sale.command'
import { ConvertOrderToSaleHandler } from './convert-order-to-sale.handler'

describe('ConvertOrderToSaleHandler', () => {
  const audit = new AuditContext('admin-1')

  function buildGiftedOrder(): Order {
    const order = Order.create({
      previewLinkId: null,
      eventId: 'event-1',
      userId: 'user-1',
      notes: null,
    })
    order.markAsGift('admin-0')
    return order
  }

  it('throws when the order does not exist', async () => {
    const readRepo = { findById: jest.fn().mockResolvedValue(null) }
    const writeRepo = { save: jest.fn() }
    const handler = new ConvertOrderToSaleHandler(writeRepo as never, readRepo as never)

    await expect(handler.execute(new ConvertOrderToSaleCommand('missing', audit))).rejects.toThrow(
      AppException,
    )
    expect(writeRepo.save).not.toHaveBeenCalled()
  })

  it('converts the order and saves it', async () => {
    const order = buildGiftedOrder()
    const readRepo = { findById: jest.fn().mockResolvedValue(order) }
    const writeRepo = { save: jest.fn().mockResolvedValue(order) }
    const handler = new ConvertOrderToSaleHandler(writeRepo as never, readRepo as never)

    const result = await handler.execute(new ConvertOrderToSaleCommand(order.id, audit))

    expect(order.status).toBe('paid')
    expect(order.confirmedById).toBe('admin-1')
    expect(writeRepo.save).toHaveBeenCalledWith(order)
    expect(result).toEqual({ id: order.id })
  })
})
