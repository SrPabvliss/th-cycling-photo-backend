import { Pagination } from '@shared/application'
import { UserReadRepository } from './user-read.repository'

function buildRepository() {
  const findMany = jest.fn().mockResolvedValue([])
  const count = jest.fn().mockResolvedValue(0)

  const prisma = {
    user: { findMany, count },
  }

  return {
    repository: new UserReadRepository(prisma as never),
    findMany,
  }
}

describe('UserReadRepository draft visibility', () => {
  it('keeps a draft out of a buyer last order date', async () => {
    const { repository, findMany } = buildRepository()

    await repository.getBuyersList(new Pagination(1, 20))

    const { select } = findMany.mock.calls[0][0]
    expect(JSON.stringify(select.orders_placed.where)).toContain('draft')
  })
})
