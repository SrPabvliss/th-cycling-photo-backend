import { AuditContext } from '@shared/application'
import { EventScope } from '@shared/authorization/domain/event-scope.vo'
import type { IAuthorizationService } from '@shared/authorization/domain/ports/authorization.service.port'
import { AppException } from '@shared/domain'
import { Order } from '../../../domain/entities'
import { RegenerateDeliveryCommand } from './regenerate-delivery.command'
import { RegenerateDeliveryHandler } from './regenerate-delivery.handler'

describe('RegenerateDeliveryHandler', () => {
  const audit = new AuditContext('admin-1')
  const unrestrictedScope = EventScope.unrestricted()

  function buildDeliveredOrder(): Order {
    const order = Order.create({
      previewLinkId: null,
      eventId: 'event-1',
      userId: 'user-1',
      notes: null,
    })
    order.confirmPayment('admin-0')
    order.markDelivered()
    return order
  }

  function buildHandler() {
    const orderReadRepo = {
      findByIdInScope: jest.fn(),
      getDetail: jest.fn().mockResolvedValue(null),
    }
    const authz = {
      can: jest.fn(),
      assert: jest.fn().mockResolvedValue(undefined),
      resolveEventScope: jest.fn().mockResolvedValue(unrestrictedScope),
    } as unknown as jest.Mocked<IAuthorizationService>
    const commandBus = {
      execute: jest.fn().mockResolvedValue({ deliveryUrl: 'https://example.com/d/new-token' }),
    }
    const handler = new RegenerateDeliveryHandler(
      orderReadRepo as never,
      authz,
      commandBus as never,
    )
    return { orderReadRepo, authz, commandBus, handler }
  }

  it('throws when the order does not exist', async () => {
    const { orderReadRepo, commandBus, authz, handler } = buildHandler()
    orderReadRepo.findByIdInScope.mockResolvedValue(null)

    await expect(handler.execute(new RegenerateDeliveryCommand('missing', audit))).rejects.toThrow(
      AppException,
    )
    expect(commandBus.execute).not.toHaveBeenCalled()
    expect(authz.assert).not.toHaveBeenCalled()
  })

  it('throws NOT_FOUND — not FORBIDDEN — when the order exists but its event is outside the caller scope', async () => {
    const { orderReadRepo, commandBus, authz, handler } = buildHandler()
    const restrictedScope = new EventScope(false, ['my-tenant'], [])
    authz.resolveEventScope.mockResolvedValueOnce(restrictedScope)
    orderReadRepo.findByIdInScope.mockResolvedValue(null)

    const error = await handler
      .execute(new RegenerateDeliveryCommand('other-tenant-order', audit))
      .catch((e) => e)

    expect(error).toBeInstanceOf(AppException)
    expect(error.code).toBe('NOT_FOUND')
    expect(orderReadRepo.findByIdInScope).toHaveBeenCalledWith(
      'other-tenant-order',
      restrictedScope,
    )
    expect(authz.assert).not.toHaveBeenCalled()
    expect(commandBus.execute).not.toHaveBeenCalled()
  })

  it('regenerates the delivery link for a delivered order and re-fetches detail with the same scope', async () => {
    const { orderReadRepo, commandBus, authz, handler } = buildHandler()
    const order = buildDeliveredOrder()
    orderReadRepo.findByIdInScope.mockResolvedValue(order)

    const result = await handler.execute(new RegenerateDeliveryCommand(order.id, audit))

    expect(authz.assert).toHaveBeenCalledWith('admin-1', 'order.delivery.regenerate', 'event-1')
    expect(commandBus.execute).toHaveBeenCalledTimes(1)
    expect(orderReadRepo.getDetail).toHaveBeenCalledWith(order.id, unrestrictedScope)
    expect(result.orderId).toBe(order.id)
  })
})
