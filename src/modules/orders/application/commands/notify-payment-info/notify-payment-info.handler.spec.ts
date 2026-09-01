import { Order } from '@orders/domain/entities/order.entity'
import { OrderStatus } from '@orders/domain/value-objects/order-status.vo'
import { AuditContext } from '@shared/application'
import { EventScope } from '@shared/authorization/domain/event-scope.vo'
import type { IAuthorizationService } from '@shared/authorization/domain/ports/authorization.service.port'
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
  const unrestrictedScope = EventScope.unrestricted()
  let readRepo: { findByIdInScope: jest.Mock; getDetail: jest.Mock }
  let writeRepo: { save: jest.Mock }
  let authz: jest.Mocked<IAuthorizationService>
  let handler: NotifyPaymentInfoHandler
  let bankAccounts: { resolveForEvent: jest.Mock }

  beforeEach(() => {
    readRepo = { findByIdInScope: jest.fn(), getDetail: jest.fn().mockResolvedValue(null) }
    writeRepo = { save: jest.fn().mockResolvedValue(undefined) }
    authz = {
      can: jest.fn(),
      assert: jest.fn().mockResolvedValue(undefined),
      resolveEventScope: jest.fn().mockResolvedValue(unrestrictedScope),
    } as jest.Mocked<IAuthorizationService>
    bankAccounts = { resolveForEvent: jest.fn().mockResolvedValue(null) }
    handler = new NotifyPaymentInfoHandler(
      writeRepo as never,
      readRepo as never,
      authz,
      bankAccounts as never,
    )
  })

  it('throws not-found when order does not exist', async () => {
    readRepo.findByIdInScope.mockResolvedValue(null)

    await expect(
      handler.execute(new NotifyPaymentInfoCommand('missing', new AuditContext('admin-1'))),
    ).rejects.toThrow(AppException)
    expect(writeRepo.save).not.toHaveBeenCalled()
    expect(authz.assert).not.toHaveBeenCalled()
  })

  it('throws NOT_FOUND — not FORBIDDEN — when the order exists but its event is outside the caller scope', async () => {
    const restrictedScope = new EventScope(false, ['my-tenant'], [])
    authz.resolveEventScope.mockResolvedValueOnce(restrictedScope)
    readRepo.findByIdInScope.mockResolvedValue(null)

    const error = await handler
      .execute(new NotifyPaymentInfoCommand('other-tenant-order', new AuditContext('admin-1')))
      .catch((e) => e)

    expect(error).toBeInstanceOf(AppException)
    expect(error.code).toBe('NOT_FOUND')
    expect(readRepo.findByIdInScope).toHaveBeenCalledWith('other-tenant-order', restrictedScope)
    expect(authz.assert).not.toHaveBeenCalled()
    expect(writeRepo.save).not.toHaveBeenCalled()
  })

  it('transitions pending order to payment_info_sent and persists it', async () => {
    const order = buildOrder()
    readRepo.findByIdInScope.mockResolvedValue(order)

    const result = await handler.execute(
      new NotifyPaymentInfoCommand(order.id, new AuditContext('admin-1')),
    )

    expect(authz.assert).toHaveBeenCalledWith('admin-1', 'order.notify_payment', 'event-1')
    expect(order.status).toBe(OrderStatus.PAYMENT_INFO_SENT)
    expect(order.notifiedById).toBe('admin-1')
    expect(writeRepo.save).toHaveBeenCalledWith(order)
    expect(result).toMatchObject({ id: order.id })
  })

  it('is idempotent on already-notified orders (no audit overwrite)', async () => {
    const order = buildOrder()
    order.notifyPaymentInfo('admin-1')
    const originalNotifiedAt = order.notifiedAt
    readRepo.findByIdInScope.mockResolvedValue(order)

    const result = await handler.execute(
      new NotifyPaymentInfoCommand(order.id, new AuditContext('admin-2')),
    )

    expect(order.notifiedById).toBe('admin-1')
    expect(order.notifiedAt).toBe(originalNotifiedAt)
    expect(writeRepo.save).toHaveBeenCalledWith(order)
    expect(result).toMatchObject({ id: order.id })
  })

  it('puts the resolved account in the message, so a resend is not an empty promise', async () => {
    const order = buildOrder()
    readRepo.findByIdInScope.mockResolvedValue(order)
    bankAccounts.resolveForEvent.mockResolvedValue({
      bankName: 'Banco Pichincha',
      accountType: 'savings',
      accountNumber: '321421412',
      accountHolder: 'FRANKLIN VILLACRES',
      holderIdentification: '1804',
    })

    const result = await handler.execute(
      new NotifyPaymentInfoCommand(order.id, new AuditContext('admin-1')),
    )

    expect(bankAccounts.resolveForEvent).toHaveBeenCalledWith('event-1')
    expect(result.whatsappTemplate).toContain('321421412')
  })

  it('carries the account on every resend, not only on the first notification', async () => {
    const order = buildOrder()
    order.notifyPaymentInfo('admin-1')
    readRepo.findByIdInScope.mockResolvedValue(order)
    bankAccounts.resolveForEvent.mockResolvedValue({
      bankName: 'Banco Pichincha',
      accountType: 'savings',
      accountNumber: '321421412',
      accountHolder: 'FRANKLIN VILLACRES',
      holderIdentification: '1804',
    })

    const result = await handler.execute(
      new NotifyPaymentInfoCommand(order.id, new AuditContext('admin-1')),
    )

    expect(result.whatsappTemplate).toContain('321421412')
  })
})
