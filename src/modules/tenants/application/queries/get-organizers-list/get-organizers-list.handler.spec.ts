import { Pagination } from '@shared/application'
import type { IOrganizerReadRepository } from '../../../domain/ports/organizer-read-repository.port'
import { GetOrganizersListHandler } from './get-organizers-list.handler'
import { GetOrganizersListQuery } from './get-organizers-list.query'

const EMPTY_PAGE = { items: [], total: 0 }

describe('GetOrganizersListHandler', () => {
  it('passes the filters and pagination straight through to the repository', async () => {
    const repo: jest.Mocked<Pick<IOrganizerReadRepository, 'getOrganizersPage'>> = {
      getOrganizersPage: jest.fn().mockResolvedValue(EMPTY_PAGE),
    }
    const handler = new GetOrganizersListHandler(repo as never)
    const pagination = new Pagination(2, 20)

    await handler.execute(
      new GetOrganizersListQuery(pagination, { tab: 'no_quota', search: 'bike' }),
    )

    expect(repo.getOrganizersPage).toHaveBeenCalledWith(
      { tab: 'no_quota', search: 'bike' },
      pagination,
    )
  })
})
