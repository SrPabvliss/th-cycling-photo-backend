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
  let writeRepo: {
    save: jest.Mock
    findByIdForUpdate: jest.Mock
    findPaymentsForUpdate: jest.Mock
  }
  let authz: jest.Mocked<IAuthorizationService>
  let handler: CancelOrderHandler
  const fakeTx = { fakeTx: true }
  let invoiceRequester: { request: jest.Mock; withdraw: jest.Mock }

  beforeEach(() => {
    readRepo = { findByIdInScope: jest.fn() }
    writeRepo = {
      save: jest.fn().mockResolvedValue(undefined),
      // Under the lock the order is read again; by default it is the one the scoped load found.
      findByIdForUpdate: jest.fn(async () => readRepo.findByIdInScope.mock.results[0]?.value),
      findPaymentsForUpdate: jest.fn().mockResolvedValue({ statuses: [], beingConfirmed: false }),
    }
    authz = {
      can: jest.fn(),
      assert: jest.fn().mockResolvedValue(undefined),
      canAnywhere: jest.fn(),
      resolveEventScope: jest.fn().mockResolvedValue(unrestrictedScope),
    } as jest.Mocked<IAuthorizationService>
    const prisma = { $transaction: jest.fn(async (work: (tx: unknown) => unknown) => work(fakeTx)) }
    invoiceRequester = { request: jest.fn(), withdraw: jest.fn() }
    handler = new CancelOrderHandler(
      writeRepo as never,
      readRepo as never,
      authz,
      prisma as never,
      invoiceRequester as never,
    )
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
    expect(writeRepo.save).toHaveBeenCalledWith(order, fakeTx)
    expect(invoiceRequester.withdraw).toHaveBeenCalledWith(order.id, 'cancelled', fakeTx)
    expect(result).toEqual({ id: order.id })
  })

  it('cancels the order as read again under its lock, not the copy loaded before it', async () => {
    readRepo.findByIdInScope.mockResolvedValue(buildOrder())
    const locked = buildOrder()
    locked.confirmPayment('staff-2')
    writeRepo.findByIdForUpdate.mockResolvedValue(locked)

    await handler.execute(command)

    expect(writeRepo.findByIdForUpdate).toHaveBeenCalledWith('order-1', fakeTx)
    expect(writeRepo.save).toHaveBeenCalledWith(locked, fakeTx)
    expect(locked.status).toBe('cancelled')
    expect(locked.paidAt).not.toBeNull()
  })

  it('answers NOT_FOUND when the order disappears before its lock', async () => {
    readRepo.findByIdInScope.mockResolvedValue(buildOrder())
    writeRepo.findByIdForUpdate.mockResolvedValue(null)

    await expect(handler.execute(command)).rejects.toMatchObject({ code: 'NOT_FOUND' })
    expect(writeRepo.save).not.toHaveBeenCalled()
  })

  it.each([
    ['initiated'],
    ['confirming'],
    ['approved'],
  ])('refuses to cancel an unpaid order while the buyer card payment is %s', async (status) => {
    const order = buildOrder()
    readRepo.findByIdInScope.mockResolvedValue(order)
    writeRepo.findPaymentsForUpdate.mockResolvedValue({ statuses: [status], beingConfirmed: false })

    await expect(handler.execute(command)).rejects.toMatchObject({
      messageKey: 'order.buyer_payment_in_progress',
    })
    expect(writeRepo.findPaymentsForUpdate).toHaveBeenCalledWith(order.id, fakeTx)
    expect(writeRepo.save).not.toHaveBeenCalled()
    expect(invoiceRequester.withdraw).not.toHaveBeenCalled()
  })

  it('refuses at once while a confirmation holds one of the buyer card payments', async () => {
    readRepo.findByIdInScope.mockResolvedValue(buildOrder())
    writeRepo.findPaymentsForUpdate.mockResolvedValue({ statuses: [], beingConfirmed: true })

    await expect(handler.execute(command)).rejects.toMatchObject({
      messageKey: 'order.buyer_payment_in_progress',
    })
    expect(writeRepo.save).not.toHaveBeenCalled()
  })
})
