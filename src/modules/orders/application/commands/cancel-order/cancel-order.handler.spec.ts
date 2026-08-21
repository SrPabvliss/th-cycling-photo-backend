import { Order } from '@orders/domain/entities'
import { EventScope } from '@shared/authorization/domain/event-scope.vo'
import type { IAuthorizationService } from '@shared/authorization/domain/ports/authorization.service.port'
import { AppException } from '@shared/domain'
import { CancelOrderCommand } from './cancel-order.command'
import { CancelOrderHandler } from './cancel-order.handler'

describe('CancelOrderHandler', () => {
  const unrestrictedScope = EventScope.unrestricted()
  const command = new CancelOrderCommand('order-1', 'user-1')

  function buildOrder() {
    return Order.create({
      previewLinkId: null,
      eventId: 'event-1',
      userId: 'buyer-1',
      notes: null,
    })
  }

  let readRepo: { findByIdInScope: jest.Mock }
  let writeRepo: { save: jest.Mock }
  let authz: jest.Mocked<IAuthorizationService>
  let handler: CancelOrderHandler

  beforeEach(() => {
    readRepo = { findByIdInScope: jest.fn() }
    writeRepo = { save: jest.fn().mockResolvedValue(undefined) }
    authz = {
      can: jest.fn(),
      assert: jest.fn().mockResolvedValue(undefined),
      resolveEventScope: jest.fn().mockResolvedValue(unrestrictedScope),
    } as jest.Mocked<IAuthorizationService>
    handler = new CancelOrderHandler(writeRepo as never, readRepo as never, authz)
  })

  it('throws NOT_FOUND when the order does not exist', async () => {
    readRepo.findByIdInScope.mockResolvedValue(null)

    const error = await handler.execute(command).catch((e) => e)

    expect(error).toBeInstanceOf(AppException)
    expect(error.code).toBe('NOT_FOUND')
    expect(authz.assert).not.toHaveBeenCalled()
    expect(writeRepo.save).not.toHaveBeenCalled()
  })

  it('throws NOT_FOUND — not FORBIDDEN — when the order exists but its event is outside the caller scope', async () => {
    const restrictedScope = new EventScope(false, ['my-tenant'], [])
    authz.resolveEventScope.mockResolvedValueOnce(restrictedScope)
    readRepo.findByIdInScope.mockResolvedValue(null)

    const error = await handler.execute(command).catch((e) => e)

    expect(error).toBeInstanceOf(AppException)
    expect(error.code).toBe('NOT_FOUND')
    expect(readRepo.findByIdInScope).toHaveBeenCalledWith('order-1', restrictedScope)
    expect(authz.assert).not.toHaveBeenCalled()
    expect(writeRepo.save).not.toHaveBeenCalled()
  })

  it('rejects when the caller holds order.cancel in general but is denied on this event', async () => {
    readRepo.findByIdInScope.mockResolvedValue(buildOrder())
    authz.assert.mockRejectedValueOnce(new Error('Insufficient permissions'))

    await expect(handler.execute(command)).rejects.toThrow('Insufficient permissions')
    expect(writeRepo.save).not.toHaveBeenCalled()
  })

  it('cancels a pending order and persists it', async () => {
    const order = buildOrder()
    readRepo.findByIdInScope.mockResolvedValue(order)

    const result = await handler.execute(command)

    expect(authz.assert).toHaveBeenCalledWith('user-1', 'order.cancel', 'event-1')
    expect(order.status).toBe('cancelled')
    expect(writeRepo.save).toHaveBeenCalledWith(order)
    expect(result).toEqual({ id: order.id })
  })
})
