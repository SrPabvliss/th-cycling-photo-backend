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
    // Under the lock the handler reads the order again; by default that read finds what the
    // scoped load found.
    const writeRepo = {
      save: jest.fn(),
      findByIdForUpdate: jest.fn(() => readRepo.findByIdInScope.mock.results.at(-1)?.value),
    }
    const authz = {
      can: jest.fn(),
      assert: jest.fn().mockResolvedValue(undefined),
      resolveEventScope: jest.fn().mockResolvedValue(unrestrictedScope),
    } as unknown as jest.Mocked<IAuthorizationService>
    const notifications = { emitOrderPaid: jest.fn() } as unknown as jest.Mocked<
      Pick<NotificationsService, 'emitOrderPaid'>
    >
    const fakeTx = { fakeTx: true }
    const prisma = { $transaction: jest.fn(async (work: (tx: unknown) => unknown) => work(fakeTx)) }
    const invoiceRequester = { request: jest.fn(), withdraw: jest.fn() }
    const handler = new ConfirmOrderPaymentHandler(
      writeRepo as never,
      readRepo as never,
      authz,
      notifications as never,
      prisma as never,
      invoiceRequester as never,
    )
    return { readRepo, writeRepo, authz, notifications, handler, fakeTx, invoiceRequester }
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
    const { readRepo, writeRepo, authz, handler, fakeTx, invoiceRequester } = buildHandler()
    const order = buildPendingOrder()
    readRepo.findByIdInScope.mockResolvedValue(order)
    writeRepo.save.mockResolvedValue(order)

    const result = await handler.execute(new ConfirmOrderPaymentCommand(order.id, audit))

    expect(authz.assert).toHaveBeenCalledWith('admin-1', 'order.confirm_payment', 'event-1')
    expect(order.status).toBe('paid')
    expect(writeRepo.save).toHaveBeenCalledWith(order, fakeTx)
    expect(invoiceRequester.request).toHaveBeenCalledWith(order.id, fakeTx)
    expect(readRepo.getDetail).toHaveBeenCalledWith(order.id, unrestrictedScope)
    expect(result).toEqual({ id: order.id })
  })

  describe('when two runs pay the same order', () => {
    it('locks and re-reads the order inside the same transaction that saves it', async () => {
      const { readRepo, writeRepo, handler, fakeTx } = buildHandler()
      readRepo.findByIdInScope.mockResolvedValue(buildPendingOrder())

      await handler.execute(new ConfirmOrderPaymentCommand('order-1', audit))

      expect(writeRepo.findByIdForUpdate).toHaveBeenCalledWith('order-1', fakeTx)
    })

    it('pays the order read under the lock, not the one loaded before it', async () => {
      const { readRepo, writeRepo, handler, fakeTx, invoiceRequester } = buildHandler()
      const loadedBefore = buildPendingOrder()
      const readUnderLock = Object.assign(buildPendingOrder(), { id: loadedBefore.id })
      readRepo.findByIdInScope.mockResolvedValue(loadedBefore)
      writeRepo.findByIdForUpdate.mockResolvedValue(readUnderLock)

      await handler.execute(new ConfirmOrderPaymentCommand(loadedBefore.id, audit))

      expect(readUnderLock.status).toBe('paid')
      expect(loadedBefore.status).toBe('pending')
      expect(writeRepo.save).toHaveBeenCalledWith(readUnderLock, fakeTx)
      expect(invoiceRequester.request).toHaveBeenCalledWith(loadedBefore.id, fakeTx)
    })

    it.each([
      ['paid', (order: Order) => order.confirmPayment('someone')],
      [
        'delivered',
        (order: Order) => {
          order.confirmPayment('someone')
          order.markDelivered()
        },
      ],
    ])('skips quietly, with no effects, an order already %s by another run', async (_status, settle) => {
      const { readRepo, writeRepo, handler, notifications, invoiceRequester } = buildHandler()
      const loadedBefore = buildPendingOrder()
      const readUnderLock = Object.assign(buildPendingOrder(), { id: loadedBefore.id })
      settle(readUnderLock)
      readRepo.findByIdInScope.mockResolvedValue(loadedBefore)
      writeRepo.findByIdForUpdate.mockResolvedValue(readUnderLock)

      const result = await handler.execute(
        new ConfirmOrderPaymentCommand(loadedBefore.id, audit, 'skip'),
      )

      expect(result).toEqual({ id: loadedBefore.id, alreadyPaid: true })
      expect(writeRepo.save).not.toHaveBeenCalled()
      expect(invoiceRequester.request).not.toHaveBeenCalled()
      expect(notifications.emitOrderPaid).not.toHaveBeenCalled()
    })

    it('answers staff with order.not_pending, with no effects, when another run paid it first', async () => {
      const { readRepo, writeRepo, handler, notifications, invoiceRequester } = buildHandler()
      const loadedBefore = buildPendingOrder()
      const readUnderLock = Object.assign(buildPendingOrder(), { id: loadedBefore.id })
      readUnderLock.confirmPayment('someone')
      readRepo.findByIdInScope.mockResolvedValue(loadedBefore)
      writeRepo.findByIdForUpdate.mockResolvedValue(readUnderLock)

      await expect(
        handler.execute(new ConfirmOrderPaymentCommand(loadedBefore.id, audit)),
      ).rejects.toMatchObject({ messageKey: 'order.not_pending' })

      expect(writeRepo.save).not.toHaveBeenCalled()
      expect(invoiceRequester.request).not.toHaveBeenCalled()
      expect(notifications.emitOrderPaid).not.toHaveBeenCalled()
    })

    /**
     * A stand-in for Postgres: one stored order, a transaction that holds its row lock from
     * `findByIdForUpdate` until it ends, and a save that becomes visible on commit.
     */
    function lockingOrderStore(stored: Order) {
      let committed = OrderSnapshot.of(stored)
      let lockQueue: Promise<void> = Promise.resolve()

      const prisma = {
        $transaction: jest.fn(async (work: (tx: object) => Promise<unknown>) => {
          const tx: { release?: () => void; pending?: Order } = {}
          try {
            const result = await work(tx)
            if (tx.pending) committed = OrderSnapshot.of(tx.pending)
            return result
          } finally {
            tx.release?.()
          }
        }),
      }
      const writeRepo = {
        findByIdForUpdate: jest.fn(async (_id: string, tx: { release?: () => void }) => {
          const previous = lockQueue
          lockQueue = new Promise<void>((resolve) => {
            tx.release = resolve
          })
          await previous
          return committed.toOrder()
        }),
        save: jest.fn(async (order: Order, tx: { pending?: Order }) => {
          // Lets the other run reach the lock while this one still holds it.
          await new Promise((resolve) => setImmediate(resolve))
          tx.pending = order
          return order
        }),
      }
      return { prisma, writeRepo, committedStatus: () => committed.status }
    }

    it('saves, requests the invoice and notifies once when two runs race', async () => {
      const pending = buildPendingOrder()
      const store = lockingOrderStore(pending)
      const readRepo = {
        findByIdInScope: jest.fn(async () => OrderSnapshot.of(pending).toOrder()),
        getDetail: jest.fn().mockResolvedValue(null),
      }
      const authz = {
        assert: jest.fn().mockResolvedValue(undefined),
        resolveEventScope: jest.fn().mockResolvedValue(unrestrictedScope),
      }
      const notifications = { emitOrderPaid: jest.fn() }
      const invoiceRequester = { request: jest.fn() }
      const handler = new ConfirmOrderPaymentHandler(
        store.writeRepo as never,
        readRepo as never,
        authz as never,
        notifications as never,
        store.prisma as never,
        invoiceRequester as never,
      )

      const results = await Promise.all([
        handler.execute(new ConfirmOrderPaymentCommand(pending.id, audit, 'skip')),
        handler.execute(new ConfirmOrderPaymentCommand(pending.id, audit, 'skip')),
      ])

      expect(store.committedStatus()).toBe('paid')
      expect(store.writeRepo.save).toHaveBeenCalledTimes(1)
      expect(invoiceRequester.request).toHaveBeenCalledTimes(1)
      expect(notifications.emitOrderPaid).toHaveBeenCalledTimes(1)
      expect(results).toEqual(
        expect.arrayContaining([{ id: pending.id }, { id: pending.id, alreadyPaid: true }]),
      )
    })
  })
})

/** A copy of an order's persisted state, so each read gets its own entity as Prisma would. */
class OrderSnapshot {
  private constructor(private readonly data: Parameters<typeof Order.fromPersistence>[0]) {}

  static of(order: Order): OrderSnapshot {
    return new OrderSnapshot({
      ...(order as unknown as Parameters<typeof Order.fromPersistence>[0]),
    })
  }

  get status(): string {
    return this.data.status
  }

  toOrder(): Order {
    return Order.fromPersistence({ ...this.data })
  }
}
