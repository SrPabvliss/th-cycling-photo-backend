import { OrderStatus } from '@orders/domain/value-objects/order-status.vo'
import { OrderReadRepository } from './order-read.repository'

function buildRepository() {
  const findMany = jest.fn().mockResolvedValue([])
  const findFirst = jest.fn().mockResolvedValue(null)
  const count = jest.fn().mockResolvedValue(0)
  const groupBy = jest.fn().mockResolvedValue([])
  const orderItemCount = jest.fn().mockResolvedValue(0)
  const orderItemFindMany = jest.fn().mockResolvedValue([])
  const paymentTransactionOrderCount = jest.fn().mockResolvedValue(0)
  const cdn = { galleryUrl: jest.fn((slug: string) => `https://cdn.test/gallery/${slug}.jpg`) }

  const prisma = {
    order: { findMany, findFirst, count, groupBy },
    orderItem: { count: orderItemCount, findMany: orderItemFindMany },
    paymentTransactionOrder: { count: paymentTransactionOrderCount },
  }

  return {
    repository: new OrderReadRepository(prisma as never, cdn as never),
    findMany,
    findFirst,
    groupBy,
    orderItemCount,
    orderItemFindMany,
    paymentTransactionOrderCount,
    cdn,
  }
}

describe('OrderReadRepository draft visibility', () => {
  it('keeps drafts out of the operator list', async () => {
    const { repository, findMany } = buildRepository()

    await repository.getList({ page: 1, limit: 20, skip: 0, take: 20 } as never, {})

    const { where } = findMany.mock.calls[0][0]
    expect(JSON.stringify(where)).toContain(OrderStatus.DRAFT)
  })

  it('keeps drafts out of the status counters', async () => {
    const { repository, groupBy } = buildRepository()

    await repository.countByStatus()

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

    await repository.getDetail('order-1')

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

  it('reports a payment in flight only for initiated and confirming transactions', async () => {
    const { repository, paymentTransactionOrderCount } = buildRepository()
    paymentTransactionOrderCount.mockResolvedValue(1)

    await expect(repository.hasPaymentInFlight('order-1')).resolves.toBe(true)

    const { where } = paymentTransactionOrderCount.mock.calls[0][0]
    expect(where.order_id).toBe('order-1')
    expect(where.payment_transaction.status).toEqual({ in: ['initiated', 'confirming'] })
  })
})
