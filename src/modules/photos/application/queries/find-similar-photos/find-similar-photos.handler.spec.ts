import { Photo } from '@photos/domain/entities'
import type { IPhotoReadRepository } from '@photos/domain/ports'
import { EventScope } from '@shared/authorization/domain/event-scope.vo'
import type { IAuthorizationService } from '@shared/authorization/domain/ports/authorization.service.port'
import { FindSimilarPhotosHandler } from './find-similar-photos.handler'
import { FindSimilarPhotosQuery } from './find-similar-photos.query'

describe('FindSimilarPhotosHandler', () => {
  let handler: FindSimilarPhotosHandler
  let photoReadRepo: jest.Mocked<IPhotoReadRepository>

  const photoId = '550e8400-e29b-41d4-a716-446655440000'
  const eventId = '660e8400-e29b-41d4-a716-446655440000'

  const existingPhoto = Photo.fromPersistence({
    id: photoId,
    eventId,
    filename: 'IMG_001.jpg',
    storageKey: `events/${eventId}/abc-IMG_001.jpg`,
    fileSize: BigInt(5242880),
    mimeType: 'image/jpeg',
    width: 1920,
    height: 1080,
    status: 'pending',
    capturedAt: null,
    uploadedAt: new Date(),
    processedAt: null,
    reviewedAt: null,
    publicSlug: 'test-slug',
    retouchedStorageKey: null,
    retouchedPublicSlug: null,
    retouchedFileSize: null,
    retouchedAt: null,
  })

  let authz: jest.Mocked<Pick<IAuthorizationService, 'resolveEventScope'>>
  const scope = EventScope.unrestricted()

  beforeEach(() => {
    jest.clearAllMocks()

    photoReadRepo = {
      findById: jest.fn(),
      findByIdInScope: jest.fn(),
      findSimilar: jest.fn(),
    } as unknown as jest.Mocked<IPhotoReadRepository>

    authz = { resolveEventScope: jest.fn().mockResolvedValue(scope) }

    handler = new FindSimilarPhotosHandler(photoReadRepo, authz as never)
  })

  it('should throw 404 when photo is not found (including out-of-scope)', async () => {
    photoReadRepo.findByIdInScope.mockResolvedValueOnce(null)

    const query = new FindSimilarPhotosQuery(photoId, 10, 'u1')

    await expect(handler.execute(query)).rejects.toThrow('errors.NOT_FOUND')
    expect(authz.resolveEventScope).toHaveBeenCalledWith('u1')
    expect(photoReadRepo.findByIdInScope).toHaveBeenCalledWith(photoId, scope)
  })

  it('should return empty array when no similar photos', async () => {
    photoReadRepo.findByIdInScope.mockResolvedValueOnce(existingPhoto)
    photoReadRepo.findSimilar.mockResolvedValueOnce([])

    const query = new FindSimilarPhotosQuery(photoId, 10, 'u1')
    const result = await handler.execute(query)

    expect(result).toEqual([])
    expect(photoReadRepo.findSimilar).toHaveBeenCalledWith(photoId, eventId, 10)
  })

  it('should return similar photos with similarity scores', async () => {
    photoReadRepo.findByIdInScope.mockResolvedValueOnce(existingPhoto)

    photoReadRepo.findSimilar.mockResolvedValueOnce([
      {
        id: 'aaa-111',
        filename: 'IMG_002.jpg',

        publicSlug: 'test-slug-similar-1',
        thumbnailUrl: 'https://cdn.test/internal/thumb/test-slug-similar-1.jpg?token=mock',
        similarity: 0.95,
        hasClassifications: true,
      },
      {
        id: 'bbb-222',
        filename: 'IMG_003.jpg',

        publicSlug: 'test-slug-similar-2',
        thumbnailUrl: 'https://cdn.test/internal/thumb/test-slug-similar-2.jpg?token=mock',
        similarity: 0.87,
        hasClassifications: false,
      },
    ])

    const query = new FindSimilarPhotosQuery(photoId, 5, 'u1')
    const result = await handler.execute(query)

    expect(result).toHaveLength(2)
    expect(result[0]).toEqual({
      id: 'aaa-111',
      filename: 'IMG_002.jpg',
      publicSlug: 'test-slug-similar-1',
      thumbnailUrl: 'https://cdn.test/internal/thumb/test-slug-similar-1.jpg?token=mock',
      similarity: 0.95,
      hasClassifications: true,
    })
    expect(photoReadRepo.findSimilar).toHaveBeenCalledWith(photoId, eventId, 5)
  })
})
