import { Order } from '@orders/domain/entities/order.entity'
import { OrderStatus } from '@orders/domain/value-objects/order-status.vo'
import { AuditContext } from '@shared/application'
import { AppException } from '@shared/domain'
import { NotifyPaymentInfoCommand } from './notify-payment-info.command'
import { NotifyPaymentInfoHandler } from './notify-payment-info.handler'

const buildOrder = () =>
  Order.create({
    previewLinkId: null,
    eventId: 'event-1',
    userId: 'user-1',
    notes: null,
  })

describe('NotifyPaymentInfoHandler', () => {
  let readRepo: { findById: jest.Mock }
  let writeRepo: { save: jest.Mock }
  let handler: NotifyPaymentInfoHandler

  beforeEach(() => {
    readRepo = { findById: jest.fn() }
    writeRepo = { save: jest.fn().mockResolvedValue(undefined) }
    handler = new NotifyPaymentInfoHandler(writeRepo as never, readRepo as never)
  })

  it('throws not-found when order does not exist', async () => {
    readRepo.findById.mockResolvedValue(null)

    await expect(
      handler.execute(new NotifyPaymentInfoCommand('missing', new AuditContext('admin-1'))),
    ).rejects.toThrow(AppException)
    expect(writeRepo.save).not.toHaveBeenCalled()
  })

  it('transitions pending order to payment_info_sent and persists it', async () => {
    const order = buildOrder()
    readRepo.findById.mockResolvedValue(order)

    const result = await handler.execute(
      new NotifyPaymentInfoCommand(order.id, new AuditContext('admin-1')),
    )

    expect(order.status).toBe(OrderStatus.PAYMENT_INFO_SENT)
    expect(order.notifiedById).toBe('admin-1')
    expect(writeRepo.save).toHaveBeenCalledWith(order)
    expect(result).toEqual({ id: order.id })
  })

  it('is idempotent on already-notified orders (no audit overwrite)', async () => {
    const order = buildOrder()
    order.notifyPaymentInfo('admin-1')
    const originalNotifiedAt = order.notifiedAt
    readRepo.findById.mockResolvedValue(order)

    const result = await handler.execute(
      new NotifyPaymentInfoCommand(order.id, new AuditContext('admin-2')),
    )

    expect(order.notifiedById).toBe('admin-1')
    expect(order.notifiedAt).toBe(originalNotifiedAt)
    expect(writeRepo.save).toHaveBeenCalledWith(order)
    expect(result).toEqual({ id: order.id })
  })
})
