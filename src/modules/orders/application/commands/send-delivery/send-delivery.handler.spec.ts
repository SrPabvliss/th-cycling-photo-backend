import type { NotificationsService } from '@notifications/application/services/notifications.service'
import { AuditContext } from '@shared/application'
import { EventScope } from '@shared/authorization/domain/event-scope.vo'
import type { IAuthorizationService } from '@shared/authorization/domain/ports/authorization.service.port'
import { AppException } from '@shared/domain'
import { Order } from '../../../domain/entities'
import { SendDeliveryCommand } from './send-delivery.command'
import { SendDeliveryHandler } from './send-delivery.handler'

describe('SendDeliveryHandler', () => {
  const audit = new AuditContext('admin-1')
  const unrestrictedScope = EventScope.unrestricted()

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

  function buildHandler() {
    const readRepo = {
      findByIdInScope: jest.fn(),
      getDetail: jest.fn().mockResolvedValue(null),
    }
    const writeRepo = {
      save: jest.fn(),
      updateItemsDeliveredAs: jest.fn().mockResolvedValue(undefined),
    }
    const authz = {
      can: jest.fn(),
      assert: jest.fn().mockResolvedValue(undefined),
      resolveEventScope: jest.fn().mockResolvedValue(unrestrictedScope),
    } as unknown as jest.Mocked<IAuthorizationService>
    const commandBus = {
      execute: jest.fn().mockResolvedValue({ deliveryUrl: 'https://example.com/d/token' }),
    }
    const notifications = { emitOrderDelivered: jest.fn() } as unknown as jest.Mocked<
      Pick<NotificationsService, 'emitOrderDelivered'>
    >
    const handler = new SendDeliveryHandler(
      writeRepo as never,
      readRepo as never,
      authz,
      commandBus as never,
      notifications as never,
    )
    return { readRepo, writeRepo, authz, commandBus, notifications, handler }
  }

  it('throws when the order does not exist', async () => {
    const { readRepo, writeRepo, authz, handler } = buildHandler()
    readRepo.findByIdInScope.mockResolvedValue(null)

    await expect(handler.execute(new SendDeliveryCommand('missing', audit))).rejects.toThrow(
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
      .execute(new SendDeliveryCommand('other-tenant-order', audit))
      .catch((e) => e)

    expect(error).toBeInstanceOf(AppException)
    expect(error.code).toBe('NOT_FOUND')
    expect(readRepo.findByIdInScope).toHaveBeenCalledWith('other-tenant-order', restrictedScope)
    expect(authz.assert).not.toHaveBeenCalled()
    expect(writeRepo.save).not.toHaveBeenCalled()
  })

  it('delivers a paid order and re-fetches detail with the same scope', async () => {
    const { readRepo, writeRepo, authz, handler } = buildHandler()
    const order = buildPaidOrder()
    readRepo.findByIdInScope.mockResolvedValue(order)
    writeRepo.save.mockResolvedValue(order)

    const result = await handler.execute(new SendDeliveryCommand(order.id, audit))

    expect(authz.assert).toHaveBeenCalledWith('admin-1', 'order.deliver', 'event-1')
    expect(order.status).toBe('delivered')
    expect(writeRepo.save).toHaveBeenCalledWith(order)
    expect(readRepo.getDetail).toHaveBeenCalledWith(order.id, unrestrictedScope)
    expect(result.orderId).toBe(order.id)
  })
})
