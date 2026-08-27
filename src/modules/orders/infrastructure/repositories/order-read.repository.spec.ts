import { Prisma } from '@generated/prisma/client'
import { OrderStatus } from '@orders/domain/value-objects/order-status.vo'
import { EventScope } from '@shared/authorization/domain/event-scope.vo'
import { OrderReadRepository } from './order-read.repository'

function buildRepository() {
  const findMany = jest.fn().mockResolvedValue([])
  const findFirst = jest.fn().mockResolvedValue(null)
  const count = jest.fn().mockResolvedValue(0)
  const groupBy = jest.fn().mockResolvedValue([])
  const aggregate = jest.fn().mockResolvedValue({ _sum: { subtotal: null } })
  const orderItemCount = jest.fn().mockResolvedValue(0)
  const orderItemFindMany = jest.fn().mockResolvedValue([])
  const paymentTransactionOrderCount = jest.fn().mockResolvedValue(0)
  const cdn = { galleryUrl: jest.fn((slug: string) => `https://cdn.test/gallery/${slug}.jpg`) }

  const prisma = {
    order: { findMany, findFirst, count, groupBy, aggregate },
    orderItem: { count: orderItemCount, findMany: orderItemFindMany },
    paymentTransactionOrder: { count: paymentTransactionOrderCount },
  }

  return {
    repository: new OrderReadRepository(prisma as never, cdn as never),
    findMany,
    findFirst,
    count,
    groupBy,
    aggregate,
    orderItemCount,
    orderItemFindMany,
    paymentTransactionOrderCount,
    cdn,
  }
}

describe('OrderReadRepository draft visibility', () => {
  it('keeps drafts out of the operator list', async () => {
    const { repository, findMany } = buildRepository()

    await repository.getList(
      { page: 1, limit: 20, skip: 0, take: 20 } as never,
      {},
      EventScope.unrestricted(),
    )

    const { where } = findMany.mock.calls[0][0]
    expect(JSON.stringify(where)).toContain(OrderStatus.DRAFT)
  })

  it('keeps drafts out of the status counters', async () => {
    const { repository, groupBy } = buildRepository()

    await repository.countByStatus(undefined, EventScope.unrestricted())

    const { where } = groupBy.mock.calls[0][0]
    expect(JSON.stringify(where)).toContain(OrderStatus.DRAFT)
  })

  it('lets a photo be deleted even when a dead draft still references it', async () => {
    const { repository, orderItemCount } = buildRepository()

    await repository.existsByPhotoId('photo-1')

    const { where } = orderItemCount.mock.calls[0][0]
    expect(JSON.stringify(where)).toContain(OrderStatus.DRAFT)
  })

  it('keeps a draft out of order detail lookups', async () => {
    const { repository, findFirst } = buildRepository()

    await repository.getDetail('order-1', EventScope.unrestricted())

    const { where } = findFirst.mock.calls[0][0]
    expect(JSON.stringify(where)).toContain(OrderStatus.DRAFT)
  })

  it('keeps a draft out of the retouch-completed notification query', async () => {
    const { repository, findMany } = buildRepository()

    await repository.findOrdersFullyRetouchedByPhoto('photo-1')

    const { where } = findMany.mock.calls[0][0]
    expect(JSON.stringify(where)).toContain(OrderStatus.DRAFT)
  })
})

describe('OrderReadRepository.getPhotoIdsByOrderIds', () => {
  it('resolves the distinct photo ids across the given orders', async () => {
    const { repository, orderItemFindMany } = buildRepository()
    orderItemFindMany.mockResolvedValue([{ photo_id: 'photo-1' }, { photo_id: 'photo-2' }])

    const photoIds = await repository.getPhotoIdsByOrderIds(['order-1', 'order-2'])

    expect(photoIds).toEqual(['photo-1', 'photo-2'])
    expect(orderItemFindMany).toHaveBeenCalledWith({
      where: { order_id: { in: ['order-1', 'order-2'] } },
      select: { photo_id: true },
      distinct: ['photo_id'],
    })
  })

  it('short-circuits without querying when there are no order ids', async () => {
    const { repository, orderItemFindMany } = buildRepository()

    const photoIds = await repository.getPhotoIdsByOrderIds([])

    expect(photoIds).toEqual([])
    expect(orderItemFindMany).not.toHaveBeenCalled()
  })
})

describe('OrderReadRepository customer scoping', () => {
  it('scopes the customer list to the caller and hides drafts', async () => {
    const { repository, findMany } = buildRepository()

    await repository.getMyList('user-1', { page: 1, limit: 20, skip: 0, take: 20 } as never)

    const { where } = findMany.mock.calls[0][0]
    expect(where.user_id).toBe('user-1')
    expect(where.status).toEqual({ not: OrderStatus.DRAFT })
  })

  it('scopes the customer detail to the caller and hides drafts', async () => {
    const { repository, findFirst } = buildRepository()

    await repository.getMyDetail('user-1', 'order-1')

    const { where } = findFirst.mock.calls[0][0]
    expect(where).toMatchObject({
      id: 'order-1',
      user_id: 'user-1',
      status: { not: OrderStatus.DRAFT },
    })
  })

  it('builds watermarked gallery URLs for customer-facing detail photos', async () => {
    const { repository, findFirst, cdn } = buildRepository()
    findFirst.mockResolvedValue({
      id: 'order-1',
      status: OrderStatus.PAID,
      created_at: new Date('2026-01-01'),
      subtotal: null,
      snap_currency: 'USD',
      event: { name: 'Event 1' },
      items: [
        { photo: { id: 'photo-1', public_slug: 'slug-1' } },
        { photo: { id: 'photo-2', public_slug: 'slug-2' } },
      ],
    })

    const detail = await repository.getMyDetail('user-1', 'order-1')

    expect(cdn.galleryUrl).toHaveBeenCalledWith('slug-1')
    expect(cdn.galleryUrl).toHaveBeenCalledWith('slug-2')
    expect(detail?.photos).toEqual([
      { id: 'photo-1', galleryUrl: 'https://cdn.test/gallery/slug-1.jpg' },
      { id: 'photo-2', galleryUrl: 'https://cdn.test/gallery/slug-2.jpg' },
    ])
  })

  it('restricts download files to the caller and to ready statuses', async () => {
    const { repository, findFirst } = buildRepository()

    await repository.getMyDownloadFiles('user-1', 'order-1')

    const { where } = findFirst.mock.calls[0][0]
    expect(where.user_id).toBe('user-1')
    expect(where.status).toEqual({
      in: [OrderStatus.PAID, OrderStatus.DELIVERED, OrderStatus.GIFTED],
    })
  })

  it('maps a gifted order to its own state while keeping it downloadable', async () => {
    const { repository, findFirst } = buildRepository()
    findFirst.mockResolvedValue({
      id: 'order-1',
      status: OrderStatus.GIFTED,
      created_at: new Date('2026-01-01'),
      subtotal: null,
      snap_currency: 'USD',
      event: { name: 'Event 1' },
      items: [],
    })

    const detail = await repository.getMyDetail('user-1', 'order-1')

    expect(detail?.state).toBe('gifted')
    expect(detail?.canDownload).toBe(true)
  })

  it('scopes the summary to the caller and excludes gifted orders from spend', async () => {
    const { repository, findMany, count, orderItemCount, groupBy } = buildRepository()
    count.mockResolvedValue(4)
    orderItemCount.mockResolvedValue(9)
    findMany.mockResolvedValue([{ event_id: 'event-1' }, { event_id: 'event-2' }])
    groupBy.mockResolvedValue([
      { snap_currency: 'USD', _sum: { subtotal: { toString: () => '50.00' } } },
    ])

    const summary = await repository.getMySummary('user-1')

    expect(count.mock.calls[0][0].where.user_id).toBe('user-1')
    expect(orderItemCount.mock.calls[0][0].where.order.user_id).toBe('user-1')
    expect(orderItemCount.mock.calls[0][0].where.order.status).toEqual({
      in: [OrderStatus.PAID, OrderStatus.DELIVERED, OrderStatus.GIFTED],
    })
    expect(findMany.mock.calls[0][0].where.user_id).toBe('user-1')
    expect(groupBy.mock.calls[0][0].where.user_id).toBe('user-1')
    expect(groupBy.mock.calls[0][0].where.status).toEqual({
      in: [OrderStatus.PAID, OrderStatus.DELIVERED],
    })
    expect(summary).toEqual({
      orderCount: 4,
      photoCount: 9,
      eventCount: 2,
      spent: [{ currency: 'USD', amount: '50.00' }],
    })
  })

  it('returns an empty spend list when nothing was spent', async () => {
    const { repository, groupBy } = buildRepository()
    groupBy.mockResolvedValue([])

    const summary = await repository.getMySummary('user-1')

    expect(summary.spent).toEqual([])
  })

  it('reports a payment in flight only for initiated and confirming transactions', async () => {
    const { repository, paymentTransactionOrderCount } = buildRepository()
    paymentTransactionOrderCount.mockResolvedValue(1)

    await expect(repository.hasPaymentInFlight('order-1')).resolves.toBe(true)

    const { where } = paymentTransactionOrderCount.mock.calls[0][0]
    expect(where.order_id).toBe('order-1')
    expect(where.payment_transaction.status).toEqual({ in: ['initiated', 'confirming'] })
  })
})

describe('OrderReadRepository buyer queries are deliberately ownership-scoped, not tenant-scoped', () => {
  const assertOwnershipNotTenantScoped = (where: Record<string, unknown>) => {
    expect(where.user_id).toBe('user-1')
    expect(JSON.stringify(where)).not.toContain('tenant_id')
    expect(JSON.stringify(where)).not.toContain('event_id')
  }

  it('scopes getMyList to the buyer by user_id, with no tenant_id/event_id fragment from EventScope', async () => {
    const { repository, findMany } = buildRepository()

    await repository.getMyList('user-1', { page: 1, limit: 20, skip: 0, take: 20 } as never)

    assertOwnershipNotTenantScoped(findMany.mock.calls[0][0].where)
  })

  it('scopes getMyDetail to the buyer by user_id, with no tenant_id/event_id fragment from EventScope', async () => {
    const { repository, findFirst } = buildRepository()

    await repository.getMyDetail('user-1', 'order-1')

    assertOwnershipNotTenantScoped(findFirst.mock.calls[0][0].where)
  })

  it('scopes getMyDownloadFiles to the buyer by user_id, with no tenant_id/event_id fragment from EventScope', async () => {
    const { repository, findFirst } = buildRepository()

    await repository.getMyDownloadFiles('user-1', 'order-1')

    assertOwnershipNotTenantScoped(findFirst.mock.calls[0][0].where)
  })

  it("scopes getMySummary's queries to the buyer by user_id, with no tenant_id/event_id fragment from EventScope", async () => {
    const { repository, findMany, count, orderItemCount, groupBy } = buildRepository()

    await repository.getMySummary('user-1')

    assertOwnershipNotTenantScoped(count.mock.calls[0][0].where)
    assertOwnershipNotTenantScoped(findMany.mock.calls[0][0].where)
    assertOwnershipNotTenantScoped(groupBy.mock.calls[0][0].where)

    const orderItemWhere = orderItemCount.mock.calls[0][0].where
    expect(orderItemWhere.order.user_id).toBe('user-1')
    expect(JSON.stringify(orderItemWhere)).not.toContain('tenant_id')
    expect(JSON.stringify(orderItemWhere)).not.toContain('event_id')
  })

  it('would silently break /orders/me for every buyer if it were ever scoped through EventScope: a buyer has no tenant_id, so resolveEventScope resolves to an empty scope, whose toPrisma() matches nothing', () => {
    const scope = EventScope.empty()

    expect(scope.toPrisma()).toEqual({
      OR: [{ tenant_id: { in: [] } }, { id: { in: [] } }],
    })
  })
})

describe('OrderReadRepository.getStats', () => {
  it('excludes draft from the status groups, and never lists it in the open/awaiting status filters', async () => {
    const { repository, groupBy, aggregate, count } = buildRepository()

    await repository.getStats({}, EventScope.unrestricted())

    expect(groupBy.mock.calls[0][0].where.status).toEqual({ not: OrderStatus.DRAFT })
    expect(aggregate.mock.calls[0][0].where.status.in).not.toContain(OrderStatus.DRAFT)
    expect(count.mock.calls[0][0].where.status.in).not.toContain(OrderStatus.DRAFT)
  })

  it('sums openAmount as a decimal string over pending and payment_info_sent only', async () => {
    const { repository, aggregate } = buildRepository()
    aggregate.mockResolvedValueOnce({ _sum: { subtotal: new Prisma.Decimal('12.10') } })
    aggregate.mockResolvedValueOnce({ _sum: { subtotal: new Prisma.Decimal('45.00') } })

    const stats = await repository.getStats({}, EventScope.unrestricted())

    expect(aggregate.mock.calls[0][0].where.status).toEqual({
      in: [OrderStatus.PENDING, OrderStatus.PAYMENT_INFO_SENT],
    })
    expect(stats.openAmount).toBe('12.10')
    expect(typeof stats.openAmount).toBe('string')
  })

  it('returns "0.00" for openAmount when nothing is open, never a bare number', async () => {
    const { repository, aggregate } = buildRepository()
    aggregate.mockResolvedValue({ _sum: { subtotal: null } })

    const stats = await repository.getStats({}, EventScope.unrestricted())

    expect(stats.openAmount).toBe('0.00')
  })

  it('counts awaiting delivery as paid or gifted with no delivered_at', async () => {
    const { repository, count } = buildRepository()
    count.mockResolvedValue(2)

    const stats = await repository.getStats({}, EventScope.unrestricted())

    const { where } = count.mock.calls[0][0]
    expect(where.status).toEqual({ in: [OrderStatus.PAID, OrderStatus.GIFTED] })
    expect(where.delivered_at).toBeNull()
    expect(stats.awaitingDeliveryCount).toBe(2)
  })

  it('builds the seven tabs from the status groups, all summing all six non-draft statuses', async () => {
    const { repository, groupBy } = buildRepository()
    groupBy.mockResolvedValue([
      { status: OrderStatus.PENDING, _count: { id: 3 } },
      { status: OrderStatus.PAYMENT_INFO_SENT, _count: { id: 1 } },
      { status: OrderStatus.PAID, _count: { id: 2 } },
      { status: OrderStatus.DELIVERED, _count: { id: 4 } },
      { status: OrderStatus.GIFTED, _count: { id: 1 } },
      { status: OrderStatus.CANCELLED, _count: { id: 5 } },
    ])

    const stats = await repository.getStats({}, EventScope.unrestricted())

    expect(stats.tabs).toEqual({
      all: 16,
      pending: 3,
      payment_info_sent: 1,
      paid: 2,
      delivered: 4,
      gifted: 1,
      cancelled: 5,
    })
    expect(stats.openCount).toBe(4)
  })

  it('scopes by eventId and search without touching status', async () => {
    const { repository, groupBy } = buildRepository()

    await repository.getStats({ eventId: 'event-1', search: 'andrea' }, EventScope.unrestricted())

    const { where } = groupBy.mock.calls[0][0]
    expect(where.event_id).toBe('event-1')
    expect(JSON.stringify(where.OR)).toContain('andrea')
  })
})
