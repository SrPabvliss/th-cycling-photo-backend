import type { IOrganizerReadRepository } from '../../../domain/ports/organizer-read-repository.port'
import { GetOrganizersStatsHandler } from './get-organizers-stats.handler'
import { GetOrganizersStatsQuery } from './get-organizers-stats.query'

const EMPTY_STATS = {
  active: 0,
  noQuota: 0,
  expiring: 0,
  pending: 0,
  tabs: { all: 0, active: 0, noQuota: 0, expiring: 0, invitations: 0 },
}

describe('GetOrganizersStatsHandler', () => {
  it('passes the filters straight through to the repository', async () => {
    const repo: jest.Mocked<Pick<IOrganizerReadRepository, 'getOrganizersStats'>> = {
      getOrganizersStats: jest.fn().mockResolvedValue(EMPTY_STATS),
    }
    const handler = new GetOrganizersStatsHandler(repo as never)

    await handler.execute(new GetOrganizersStatsQuery({ search: 'bike', tab: 'no_quota' }))

    expect(repo.getOrganizersStats).toHaveBeenCalledWith({ search: 'bike', tab: 'no_quota' })
  })
})
