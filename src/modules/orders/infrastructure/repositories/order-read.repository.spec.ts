import { OrderStatus } from '@orders/domain/value-objects/order-status.vo'
import { EventScope } from '@shared/authorization/domain/event-scope.vo'
import { OrderReadRepository } from './order-read.repository'

function buildRepository() {
  const findMany = jest.fn().mockResolvedValue([])
  const findFirst = jest.fn().mockResolvedValue(null)
  const count = jest.fn().mockResolvedValue(0)
  const groupBy = jest.fn().mockResolvedValue([])
  const orderItemCount = jest.fn().mockResolvedValue(0)
  const orderItemFindMany = jest.fn().mockResolvedValue([])

  const prisma = {
    order: { findMany, findFirst, count, groupBy },
    orderItem: { count: orderItemCount, findMany: orderItemFindMany },
  }

  return {
    repository: new OrderReadRepository(prisma as never, {} as never),
    findMany,
    findFirst,
    groupBy,
    orderItemCount,
    orderItemFindMany,
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
