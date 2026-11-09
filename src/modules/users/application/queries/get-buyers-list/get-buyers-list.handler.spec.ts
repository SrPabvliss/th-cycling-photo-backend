import { Pagination } from '@shared/application'
import type { IUserReadRepository } from '@users/domain/ports'
import { GetBuyersListHandler } from './get-buyers-list.handler'
import { GetBuyersListQuery } from './get-buyers-list.query'

describe('GetBuyersListHandler', () => {
  let handler: GetBuyersListHandler
  let readRepo: jest.Mocked<Pick<IUserReadRepository, 'getBuyersList'>>

  beforeEach(() => {
    readRepo = { getBuyersList: jest.fn().mockResolvedValue({ items: [], total: 0 }) }
    handler = new GetBuyersListHandler(readRepo as never)
  })

  it('passes every filter through to the repository unchanged', async () => {
    const pagination = new Pagination(1, 20)
    const filters = {
      search: 'ana',
      purchase: 'bought' as const,
      sort: 'spent' as const,
      countryId: 1,
      provinceId: 2,
      registeredFrom: new Date('2026-01-01'),
      registeredTo: new Date('2026-02-01'),
      gender: 'female',
      ageFrom: 18,
      ageTo: 40,
      emailVerified: true,
      hasWhatsapp: true,
    }

    await handler.execute(new GetBuyersListQuery(pagination, filters))

    expect(readRepo.getBuyersList).toHaveBeenCalledWith(pagination, filters)
  })

  it('defaults purchase to "all" and sort to "recent" when omitted', async () => {
    const pagination = new Pagination(1, 20)

    await handler.execute(new GetBuyersListQuery(pagination, {}))

    expect(readRepo.getBuyersList).toHaveBeenCalledWith(pagination, {
      purchase: 'all',
      sort: 'recent',
    })
  })
})
