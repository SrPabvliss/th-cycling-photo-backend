import { Test } from '@nestjs/testing'
import { PHOTO_READ_REPOSITORY } from '@photos/domain/ports'
import { AppException } from '@shared/domain'
import { GetPhotoDetailBySlugHandler } from './get-photo-detail-by-slug.handler'
import { GetPhotoDetailBySlugQuery } from './get-photo-detail-by-slug.query'

describe('GetPhotoDetailBySlugHandler', () => {
  const repo = { getPhotoDetailBySlug: jest.fn() }
  let handler: GetPhotoDetailBySlugHandler

  beforeEach(async () => {
    jest.clearAllMocks()
    const moduleRef = await Test.createTestingModule({
      providers: [GetPhotoDetailBySlugHandler, { provide: PHOTO_READ_REPOSITORY, useValue: repo }],
    }).compile()
    handler = moduleRef.get(GetPhotoDetailBySlugHandler)
  })

  it('returns the projection from the repository', async () => {
    const projection = { id: 'photo-1', publicSlug: 'pub-slug' }
    repo.getPhotoDetailBySlug.mockResolvedValue(projection)

    const result = await handler.execute(new GetPhotoDetailBySlugQuery('pub-slug'))

    expect(repo.getPhotoDetailBySlug).toHaveBeenCalledWith('pub-slug')
    expect(result).toBe(projection)
  })

  it('throws notFound when slug does not match any photo', async () => {
    repo.getPhotoDetailBySlug.mockResolvedValue(null)

    await expect(handler.execute(new GetPhotoDetailBySlugQuery('missing'))).rejects.toBeInstanceOf(
      AppException,
    )
  })
})
