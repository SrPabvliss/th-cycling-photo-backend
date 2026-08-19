import { Order } from '@orders/domain/entities'
import type { OrderSnapData } from '@orders/domain/ports'
import { OrderStatus } from '@orders/domain/value-objects/order-status.vo'
import { OrderWriteRepository } from './order-write.repository'

const RECORD = {
  id: 'order-1',
  preview_link_id: null,
  event_id: 'event-1',
  user_id: 'user-1',
  status: OrderStatus.DRAFT,
  notes: null,
  bib_number: null,
  subtotal: null,
  snap_currency: null,
  snap_pricing_config: null,
  created_at: new Date(),
  notified_at: null,
  paid_at: null,
  delivered_at: null,
  cancelled_at: null,
  notified_by_id: null,
  confirmed_by_id: null,
  payment_method: null,
}

const SNAP: OrderSnapData = {
  snapFirstName: null,
  snapLastName: null,
  snapEmail: 'buyer@example.com',
  snapPhone: null,
  snapCountryId: 1,
  snapProvinceId: null,
  snapCantonId: null,
  snapCategoryName: null,
}

function buildRepository() {
  const executeRaw = jest.fn().mockResolvedValue(1)
  const findFirst = jest.fn().mockResolvedValue(null)
  const upsert = jest
    .fn()
    .mockImplementation((args: { create: Record<string, unknown> }) =>
      Promise.resolve({ ...RECORD, ...args.create }),
    )
  const deleteMany = jest.fn().mockResolvedValue({ count: 0 })
  const createMany = jest.fn().mockResolvedValue({ count: 0 })

  const tx = {
    $executeRaw: executeRaw,
    order: { findFirst, upsert },
    orderItem: { deleteMany, createMany },
  }

  const baseFindFirst = jest.fn()
  const baseUpsert = jest.fn()
  const baseDeleteMany = jest.fn()
  const baseCreateMany = jest.fn()

  const prisma = {
    $transaction: jest.fn((callback: (tx: unknown) => Promise<unknown>) => callback(tx)),
    order: { findFirst: baseFindFirst, upsert: baseUpsert },
    orderItem: { deleteMany: baseDeleteMany, createMany: baseCreateMany },
  }

  return {
    repository: new OrderWriteRepository(prisma as never),
    prisma,
    tx,
  }
}

function newDraftResult() {
  return {
    order: Order.createDraft({
      previewLinkId: null,
      eventId: 'event-1',
      userId: 'user-1',
      notes: null,
    }),
    items: [{ photoId: 'photo-1', unitPrice: 4 }],
    snap: SNAP,
  }
}

describe('OrderWriteRepository.lockAndUpsertDraft', () => {
  it('takes the advisory lock before reading for an existing draft', async () => {
    const { repository, tx } = buildRepository()

    await repository.lockAndUpsertDraft('user-1', 'event-1', async () => newDraftResult())

    expect(tx.$executeRaw.mock.invocationCallOrder[0]).toBeLessThan(
      tx.order.findFirst.mock.invocationCallOrder[0],
    )
  })

  it('runs the find, the upsert and the item writes on the transaction client, never the base client', async () => {
    const { repository, prisma, tx } = buildRepository()

    await repository.lockAndUpsertDraft('user-1', 'event-1', async () => newDraftResult())

    expect(tx.order.findFirst).toHaveBeenCalledTimes(1)
    expect(tx.order.upsert).toHaveBeenCalledTimes(1)
    expect(tx.orderItem.deleteMany).toHaveBeenCalledTimes(1)
    expect(tx.orderItem.createMany).toHaveBeenCalledTimes(1)

    expect(prisma.order.findFirst).not.toHaveBeenCalled()
    expect(prisma.order.upsert).not.toHaveBeenCalled()
    expect(prisma.orderItem.deleteMany).not.toHaveBeenCalled()
    expect(prisma.orderItem.createMany).not.toHaveBeenCalled()
  })

  it('passes an existing draft to build and upserts onto that same id, never a new one', async () => {
    const { repository, tx } = buildRepository()
    tx.order.findFirst.mockResolvedValueOnce({ ...RECORD, id: 'existing-1' })

    const build = jest.fn(async (existingDraft: Order | null) => {
      if (!existingDraft) throw new Error('expected an existing draft to be passed in')

      return {
        order: Order.fromPersistence({
          id: existingDraft.id,
          previewLinkId: existingDraft.previewLinkId,
          eventId: existingDraft.eventId,
          userId: existingDraft.userId,
          status: existingDraft.status,
          notes: existingDraft.notes,
          bibNumber: existingDraft.bibNumber,
          subtotal: 8,
          snapCurrency: existingDraft.snapCurrency,
          snapPricingConfig: existingDraft.snapPricingConfig,
          createdAt: existingDraft.createdAt,
          notifiedAt: existingDraft.notifiedAt,
          paidAt: existingDraft.paidAt,
          deliveredAt: existingDraft.deliveredAt,
          cancelledAt: existingDraft.cancelledAt,
          notifiedById: existingDraft.notifiedById,
          confirmedById: existingDraft.confirmedById,
          paymentMethod: existingDraft.paymentMethod,
        }),
        items: [],
        snap: SNAP,
      }
    })

    await repository.lockAndUpsertDraft('user-1', 'event-1', build)

    expect(build).toHaveBeenCalledTimes(1)
    expect(build.mock.calls[0][0]).toMatchObject({ id: 'existing-1' })
    expect(tx.order.upsert.mock.calls[0][0].where).toEqual({ id: 'existing-1' })
  })

  it('passes the transaction client to build, so callers can enlist their own writes in the same transaction', async () => {
    const { repository, tx } = buildRepository()
    const build = jest.fn(async (_existing: Order | null, _tx: unknown) => newDraftResult())

    await repository.lockAndUpsertDraft('user-1', 'event-1', build)

    expect(build.mock.calls[0][1]).toBe(tx)
  })

  it('replaces the order items only after build has resolved', async () => {
    const { repository, tx } = buildRepository()
    const build = jest.fn(async () => newDraftResult())

    await repository.lockAndUpsertDraft('user-1', 'event-1', build)

    expect(build.mock.invocationCallOrder[0]).toBeLessThan(
      tx.orderItem.deleteMany.mock.invocationCallOrder[0],
    )
    expect(build.mock.invocationCallOrder[0]).toBeLessThan(
      tx.orderItem.createMany.mock.invocationCallOrder[0],
    )
  })
})
