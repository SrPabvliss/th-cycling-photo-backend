import { Test } from '@nestjs/testing'
import { PHOTO_READ_REPOSITORY } from '@photos/domain/ports'
import { EventScope } from '@shared/authorization/domain/event-scope.vo'
import { AUTHORIZATION_SERVICE } from '@shared/authorization/domain/ports/authorization.service.port'
import { AppException } from '@shared/domain'
import { GetPhotoDetailBySlugHandler } from './get-photo-detail-by-slug.handler'
import { GetPhotoDetailBySlugQuery } from './get-photo-detail-by-slug.query'

describe('GetPhotoDetailBySlugHandler', () => {
  const repo = { getPhotoDetailBySlug: jest.fn() }
  const scope = EventScope.unrestricted()
  const authz = { resolveEventScope: jest.fn().mockResolvedValue(scope) }
  let handler: GetPhotoDetailBySlugHandler

  beforeEach(async () => {
    jest.clearAllMocks()
    authz.resolveEventScope.mockResolvedValue(scope)
    const moduleRef = await Test.createTestingModule({
      providers: [
        GetPhotoDetailBySlugHandler,
        { provide: PHOTO_READ_REPOSITORY, useValue: repo },
        { provide: AUTHORIZATION_SERVICE, useValue: authz },
      ],
    }).compile()
    handler = moduleRef.get(GetPhotoDetailBySlugHandler)
  })

  it('returns the projection from the repository', async () => {
    const projection = { id: 'photo-1', publicSlug: 'pub-slug' }
    repo.getPhotoDetailBySlug.mockResolvedValue(projection)

    const result = await handler.execute(new GetPhotoDetailBySlugQuery('pub-slug', 'u1'))

    expect(authz.resolveEventScope).toHaveBeenCalledWith('u1')
    expect(repo.getPhotoDetailBySlug).toHaveBeenCalledWith('pub-slug', scope)
    expect(result).toBe(projection)
  })

  it('throws notFound when slug does not match any photo', async () => {
    repo.getPhotoDetailBySlug.mockResolvedValue(null)

    await expect(
      handler.execute(new GetPhotoDetailBySlugQuery('missing', 'u1')),
    ).rejects.toBeInstanceOf(AppException)
  })
})
