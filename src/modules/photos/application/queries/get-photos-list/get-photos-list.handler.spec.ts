import type { IPhotoReadRepository } from '@photos/domain/ports'
import { Pagination } from '@shared/application'
import { EventScope } from '@shared/authorization/domain/event-scope.vo'
import type { IAuthorizationService } from '@shared/authorization/domain/ports/authorization.service.port'
import { GetPhotosListHandler } from './get-photos-list.handler'
import { GetPhotosListQuery } from './get-photos-list.query'

describe('GetPhotosListHandler', () => {
  const readRepo = {
    getPhotosList: jest.fn().mockResolvedValue({ items: [], total: 0 }),
  } as unknown as jest.Mocked<IPhotoReadRepository>

  it('refuses to return photos for an event outside the caller scope', async () => {
    const scope = new EventScope(false, ['t1'], [])
    const authz = {
      resolveEventScope: jest.fn().mockResolvedValue(scope),
    } as unknown as jest.Mocked<IAuthorizationService>
    const handler = new GetPhotosListHandler(readRepo, authz)

    await handler.execute(
      new GetPhotosListQuery('event-99', new Pagination(1, 20), undefined, undefined, 'u1'),
    )

    expect(authz.resolveEventScope).toHaveBeenCalledWith('u1')
    expect(readRepo.getPhotosList).toHaveBeenCalledWith(
      'event-99',
      expect.anything(),
      undefined,
      undefined,
      scope,
    )
  })
})
