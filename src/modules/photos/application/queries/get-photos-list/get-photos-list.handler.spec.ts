import type { IEventReadRepository } from '@events/domain/ports'
import type { IPhotoReadRepository } from '@photos/domain/ports'
import { Pagination } from '@shared/application'
import { EventScope } from '@shared/authorization/domain/event-scope.vo'
import type { IAuthorizationService } from '@shared/authorization/domain/ports/authorization.service.port'
import { GetPhotosListHandler } from './get-photos-list.handler'
import { GetPhotosListQuery } from './get-photos-list.query'

describe('GetPhotosListHandler', () => {
  const event = { id: 'event-1', tenantId: 't1' }
  const query = new GetPhotosListQuery('event-1', new Pagination(1, 20), {}, 'u1')

  const build = (scope: EventScope, found: unknown = event) => {
    const readRepo = {
      getPhotosList: jest.fn().mockResolvedValue({ items: [], total: 0 }),
    } as unknown as jest.Mocked<IPhotoReadRepository>
    const eventReadRepo = {
      findById: jest.fn().mockResolvedValue(found),
    } as unknown as jest.Mocked<IEventReadRepository>
    const authz = {
      resolveEventScope: jest.fn().mockResolvedValue(scope),
      assert: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<IAuthorizationService>
    return { readRepo, authz, handler: new GetPhotosListHandler(readRepo, eventReadRepo, authz) }
  }

  it('lists the photos of an event inside the caller scope', async () => {
    const scope = new EventScope(false, ['t1'], [])
    const { readRepo, authz, handler } = build(scope)

    await handler.execute(query)

    expect(authz.assert).toHaveBeenCalledWith('u1', 'photo.read', 'event-1')
    expect(readRepo.getPhotosList).toHaveBeenCalledWith('event-1', expect.anything(), {}, scope)
  })

  it('answers 404 for an event of another tenant instead of an empty page', async () => {
    const { readRepo, handler } = build(new EventScope(false, ['t2'], []))

    await expect(handler.execute(query)).rejects.toMatchObject({ httpStatus: 404 })
    expect(readRepo.getPhotosList).not.toHaveBeenCalled()
  })

  it('answers 404 for an event that does not exist', async () => {
    const { handler } = build(EventScope.unrestricted(), null)

    await expect(handler.execute(query)).rejects.toMatchObject({ httpStatus: 404 })
  })
})
