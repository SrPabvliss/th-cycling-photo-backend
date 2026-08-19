import type { IEventReadRepository } from '@events/domain/ports'
import type { IPhotoReadRepository } from '@photos/domain/ports'
import { Pagination } from '@shared/application'
import { EventScope } from '@shared/authorization/domain/event-scope.vo'
import type { IAuthorizationService } from '@shared/authorization/domain/ports/authorization.service.port'
import { GetEventsListHandler } from './get-events-list.handler'
import { GetEventsListQuery } from './get-events-list.query'

describe('GetEventsListHandler', () => {
  const readRepo = {
    getEventsList: jest.fn().mockResolvedValue({ items: [], total: 0 }),
  } as unknown as jest.Mocked<IEventReadRepository>
  const photoRepo = {
    getTotalFileSizesByEventIds: jest.fn().mockResolvedValue(new Map()),
  } as unknown as jest.Mocked<IPhotoReadRepository>

  it('passes the caller scope through to the repository', async () => {
    const scope = new EventScope(false, ['t1'], [])
    const authz = {
      resolveEventScope: jest.fn().mockResolvedValue(scope),
    } as unknown as jest.Mocked<IAuthorizationService>
    const handler = new GetEventsListHandler(readRepo, photoRepo, authz)

    await handler.execute(new GetEventsListQuery(new Pagination(1, 20), false, undefined, 'u1'))

    expect(authz.resolveEventScope).toHaveBeenCalledWith('u1')
    expect(readRepo.getEventsList).toHaveBeenCalledWith(expect.anything(), false, undefined, scope)
  })
})
