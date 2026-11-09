import { OperatorRetouchReadRepository } from './operator-retouch-read.repository'

function buildRepository() {
  const findUnique = jest.fn().mockResolvedValue(null)

  const prisma = {
    order: { findUnique },
  }

  return {
    repository: new OperatorRetouchReadRepository(prisma as never),
    findUnique,
  }
}

describe('OperatorRetouchReadRepository draft visibility', () => {
  it('keeps a draft out of the operator order detail lookup', async () => {
    const { repository, findUnique } = buildRepository()

    await repository.findOrderDetailRow('order-1', false)

    const { where } = findUnique.mock.calls[0][0]
    expect(JSON.stringify(where)).toContain('paid')
  })
})
