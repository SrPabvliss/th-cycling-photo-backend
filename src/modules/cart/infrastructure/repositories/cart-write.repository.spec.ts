import { CartWriteRepository } from './cart-write.repository'

function buildRepository() {
  const updateMany = jest.fn().mockResolvedValue({ count: 0 })

  const prisma = {
    cartItem: { updateMany },
  }

  return { repository: new CartWriteRepository(prisma as never), updateMany }
}

describe('CartWriteRepository.removeItems', () => {
  it('soft-removes only the given photo ids from the cart', async () => {
    const { repository, updateMany } = buildRepository()

    await repository.removeItems('cart-1', ['photo-1', 'photo-2'])

    expect(updateMany).toHaveBeenCalledWith({
      where: { cart_id: 'cart-1', photo_id: { in: ['photo-1', 'photo-2'] }, removed_at: null },
      data: { removed_at: expect.any(Date) },
    })
  })

  it('short-circuits without querying when there are no photo ids', async () => {
    const { repository, updateMany } = buildRepository()

    await repository.removeItems('cart-1', [])

    expect(updateMany).not.toHaveBeenCalled()
  })
})
