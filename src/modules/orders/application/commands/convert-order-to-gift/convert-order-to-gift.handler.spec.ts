import { AuditContext } from '@shared/application'
import { EventScope } from '@shared/authorization/domain/event-scope.vo'
import type { IAuthorizationService } from '@shared/authorization/domain/ports/authorization.service.port'
import { AppException } from '@shared/domain'
import { Order } from '../../../domain/entities'
import { ConvertOrderToGiftCommand } from './convert-order-to-gift.command'
import { ConvertOrderToGiftHandler } from './convert-order-to-gift.handler'

describe('ConvertOrderToGiftHandler', () => {
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
    const readRepo = { findByIdInScope: jest.fn() }
    const writeRepo = { save: jest.fn() }
    const authz = {
      can: jest.fn(),
      assert: jest.fn().mockResolvedValue(undefined),
      resolveEventScope: jest.fn().mockResolvedValue(unrestrictedScope),
    } as unknown as jest.Mocked<IAuthorizationService>
    const handler = new ConvertOrderToGiftHandler(writeRepo as never, readRepo as never, authz)
    return { readRepo, writeRepo, authz, handler }
  }

  it('throws when the order does not exist', async () => {
    const { readRepo, writeRepo, authz, handler } = buildHandler()
    readRepo.findByIdInScope.mockResolvedValue(null)

    await expect(handler.execute(new ConvertOrderToGiftCommand('missing', audit))).rejects.toThrow(
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
      .execute(new ConvertOrderToGiftCommand('other-tenant-order', audit))
      .catch((e) => e)

    expect(error).toBeInstanceOf(AppException)
    expect(error.code).toBe('NOT_FOUND')
    expect(readRepo.findByIdInScope).toHaveBeenCalledWith('other-tenant-order', restrictedScope)
    expect(authz.assert).not.toHaveBeenCalled()
    expect(writeRepo.save).not.toHaveBeenCalled()
  })

  it('converts the order and saves it', async () => {
    const { readRepo, writeRepo, authz, handler } = buildHandler()
    const order = buildPaidOrder()
    readRepo.findByIdInScope.mockResolvedValue(order)
    writeRepo.save.mockResolvedValue(order)

    const result = await handler.execute(new ConvertOrderToGiftCommand(order.id, audit))

    expect(authz.assert).toHaveBeenCalledWith('admin-1', 'order.convert_to_gift', 'event-1')
    expect(order.status).toBe('gifted')
    expect(order.paidAt).toBeNull()
    expect(writeRepo.save).toHaveBeenCalledWith(order)
    expect(result).toEqual({ id: order.id })
  })
})
