import { AppException } from '@shared/domain'
import type { IUserReadRepository } from '@users/domain/ports'
import { GetBuyerDetailHandler } from './get-buyer-detail.handler'
import { GetBuyerDetailQuery } from './get-buyer-detail.query'

describe('GetBuyerDetailHandler', () => {
  let handler: GetBuyerDetailHandler
  let readRepo: jest.Mocked<Pick<IUserReadRepository, 'getBuyerDetail'>>

  beforeEach(() => {
    readRepo = { getBuyerDetail: jest.fn() }
    handler = new GetBuyerDetailHandler(readRepo as never)
  })

  it('returns the projection the repository resolves', async () => {
    const detail = { id: 'buyer-1', orders: [], consents: [] }
    readRepo.getBuyerDetail.mockResolvedValue(detail as never)

    const result = await handler.execute(new GetBuyerDetailQuery('buyer-1'))

    expect(readRepo.getBuyerDetail).toHaveBeenCalledWith('buyer-1')
    expect(result).toBe(detail)
  })

  it('throws not-found when the repository resolves null (unknown id)', async () => {
    readRepo.getBuyerDetail.mockResolvedValue(null)

    await expect(handler.execute(new GetBuyerDetailQuery('missing'))).rejects.toThrow(AppException)
  })
})
