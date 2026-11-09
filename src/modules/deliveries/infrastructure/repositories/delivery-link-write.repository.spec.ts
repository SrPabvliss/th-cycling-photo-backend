import { DeliveryLink } from '@deliveries/domain/entities'
import { DeliveryLinkWriteRepository } from './delivery-link-write.repository'

function buildRepository() {
  const upsert = jest.fn().mockImplementation(({ create }) => ({
    ...create,
    last_downloaded_at: null,
  }))
  const updateMany = jest.fn().mockResolvedValue({ count: 1 })
  const prisma = { deliveryLink: { upsert, updateMany } }

  return {
    repository: new DeliveryLinkWriteRepository(prisma as never),
    upsert,
    updateMany,
  }
}

describe('DeliveryLinkWriteRepository.replaceForOrder', () => {
  const link = DeliveryLink.create({ orderId: 'order-1', expiresInDays: 7 })

  it('keys the upsert on the order, because a row already exists for it and order_id is unique', async () => {
    const { repository, upsert } = buildRepository()

    await repository.replaceForOrder(link)

    expect(upsert.mock.calls[0][0].where).toEqual({ order_id: 'order-1' })
  })

  it('hands the update a fresh token and an active status, so the old link stops working', async () => {
    const { repository, upsert } = buildRepository()

    await repository.replaceForOrder(link)

    const { update } = upsert.mock.calls[0][0]
    expect(update.token).toBe(link.token)
    expect(update.status).toBe('active')
    expect(update.expires_at).toEqual(link.expiresAt)
  })

  it('clears the download history, because the replacement link starts its own count', async () => {
    const { repository, upsert } = buildRepository()

    await repository.replaceForOrder(link)

    const { update } = upsert.mock.calls[0][0]
    expect(update.download_count).toBe(0)
    expect(update.first_downloaded_at).toBeNull()
    expect(update.last_downloaded_at).toBeNull()
  })

  it('leaves the primary key alone on update, so nothing pointing at the row breaks', async () => {
    const { repository, upsert } = buildRepository()

    await repository.replaceForOrder(link)

    const { update } = upsert.mock.calls[0][0]
    expect(update).not.toHaveProperty('id')
    expect(update).not.toHaveProperty('order_id')
  })
})
