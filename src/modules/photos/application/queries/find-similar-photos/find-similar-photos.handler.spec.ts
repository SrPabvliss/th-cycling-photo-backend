import { Photo } from '@photos/domain/entities'
import type { IPhotoReadRepository } from '@photos/domain/ports'
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
    unclassifiedReason: null,
    capturedAt: null,
    uploadedAt: new Date(),
    processedAt: null,
    publicSlug: 'test-slug',
    retouchedStorageKey: null,
    retouchedFileSize: null,
    retouchedAt: null,
  })

  beforeEach(() => {
    jest.clearAllMocks()

    photoReadRepo = {
      findById: jest.fn(),
      findSimilar: jest.fn(),
    } as unknown as jest.Mocked<IPhotoReadRepository>

    handler = new FindSimilarPhotosHandler(photoReadRepo)
  })

  it('should throw 404 when photo is not found', async () => {
    photoReadRepo.findById.mockResolvedValueOnce(null)

    const query = new FindSimilarPhotosQuery(photoId)

    await expect(handler.execute(query)).rejects.toThrow('errors.NOT_FOUND')
  })

  it('should return empty array when no similar photos', async () => {
    photoReadRepo.findById.mockResolvedValueOnce(existingPhoto)
    photoReadRepo.findSimilar.mockResolvedValueOnce([])

    const query = new FindSimilarPhotosQuery(photoId)
    const result = await handler.execute(query)

    expect(result).toEqual([])
    expect(photoReadRepo.findSimilar).toHaveBeenCalledWith(photoId, eventId, 10)
  })

  it('should return similar photos with similarity scores', async () => {
    photoReadRepo.findById.mockResolvedValueOnce(existingPhoto)

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

    const query = new FindSimilarPhotosQuery(photoId, 5)
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
