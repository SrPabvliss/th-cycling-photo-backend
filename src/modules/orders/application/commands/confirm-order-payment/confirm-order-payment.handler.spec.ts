import type { NotificationsService } from '@notifications/application/services/notifications.service'
import { AuditContext } from '@shared/application'
import { EventScope } from '@shared/authorization/domain/event-scope.vo'
import type { IAuthorizationService } from '@shared/authorization/domain/ports/authorization.service.port'
import { AppException } from '@shared/domain'
import { Order } from '../../../domain/entities'
import { ConfirmOrderPaymentCommand } from './confirm-order-payment.command'
import { ConfirmOrderPaymentHandler } from './confirm-order-payment.handler'

describe('ConfirmOrderPaymentHandler', () => {
  const audit = new AuditContext('admin-1')
  const unrestrictedScope = EventScope.unrestricted()

  function buildPendingOrder(): Order {
    return Order.create({
      previewLinkId: null,
      eventId: 'event-1',
      userId: 'user-1',
      notes: null,
    })
  }

  function buildHandler() {
    const readRepo = { findByIdInScope: jest.fn(), getDetail: jest.fn().mockResolvedValue(null) }
    const writeRepo = { save: jest.fn() }
    const authz = {
      can: jest.fn(),
      assert: jest.fn().mockResolvedValue(undefined),
      resolveEventScope: jest.fn().mockResolvedValue(unrestrictedScope),
    } as unknown as jest.Mocked<IAuthorizationService>
    const notifications = { emitOrderPaid: jest.fn() } as unknown as jest.Mocked<
      Pick<NotificationsService, 'emitOrderPaid'>
    >
    const handler = new ConfirmOrderPaymentHandler(
      writeRepo as never,
      readRepo as never,
      authz,
      notifications as never,
    )
    return { readRepo, writeRepo, authz, notifications, handler }
  }

  it('throws when the order does not exist', async () => {
    const { readRepo, writeRepo, authz, handler } = buildHandler()
    readRepo.findByIdInScope.mockResolvedValue(null)

    await expect(handler.execute(new ConfirmOrderPaymentCommand('missing', audit))).rejects.toThrow(
      AppException,
    )
    expect(writeRepo.save).not.toHaveBeenCalled()
    expect(authz.assert).not.toHaveBeenCalled()
  })

  it('throws NOT_FOUND — not FORBIDDEN — when the order exists but its event is outside the caller scope', async () => {
    const { readRepo, writeRepo, authz, handler } = buildHandler()
    const restrictedScope = new EventScope(false, ['my-tenant'], [])
    authz.resolveEventScope.mockResolvedValueOnce(restrictedScope)
    readRepo.findByIdInScope.mockResolvedValue(null)

    const error = await handler
      .execute(new ConfirmOrderPaymentCommand('other-tenant-order', audit))
      .catch((e) => e)

    expect(error).toBeInstanceOf(AppException)
    expect(error.code).toBe('NOT_FOUND')
    expect(readRepo.findByIdInScope).toHaveBeenCalledWith('other-tenant-order', restrictedScope)
    expect(authz.assert).not.toHaveBeenCalled()
    expect(writeRepo.save).not.toHaveBeenCalled()
  })

  it('confirms payment, persists the order, and re-fetches detail with the same scope', async () => {
    const { readRepo, writeRepo, authz, handler } = buildHandler()
    const order = buildPendingOrder()
    readRepo.findByIdInScope.mockResolvedValue(order)
    writeRepo.save.mockResolvedValue(order)

    const result = await handler.execute(new ConfirmOrderPaymentCommand(order.id, audit))

    expect(authz.assert).toHaveBeenCalledWith('admin-1', 'order.confirm_payment', 'event-1')
    expect(order.status).toBe('paid')
    expect(writeRepo.save).toHaveBeenCalledWith(order)
    expect(readRepo.getDetail).toHaveBeenCalledWith(order.id, unrestrictedScope)
    expect(result).toEqual({ id: order.id })
  })
})
