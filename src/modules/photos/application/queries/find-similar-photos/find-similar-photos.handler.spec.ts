import { Photo } from '@photos/domain/entities'
import type { IPhotoReadRepository } from '@photos/domain/ports'
import type { PrismaService } from '@shared/infrastructure/prisma/prisma.service'
import { FindSimilarPhotosHandler } from './find-similar-photos.handler'
import { FindSimilarPhotosQuery } from './find-similar-photos.query'

describe('FindSimilarPhotosHandler', () => {
  let handler: FindSimilarPhotosHandler
  let photoReadRepo: jest.Mocked<IPhotoReadRepository>
  let prisma: jest.Mocked<PrismaService>

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
    retouchedStorageKey: null,
    retouchedFileSize: null,
    retouchedAt: null,
  })

  beforeEach(() => {
    jest.clearAllMocks()

    photoReadRepo = {
      findById: jest.fn(),
    } as unknown as jest.Mocked<IPhotoReadRepository>

    prisma = {
      $queryRawUnsafe: jest.fn(),
    } as unknown as jest.Mocked<PrismaService>

    handler = new FindSimilarPhotosHandler(photoReadRepo, prisma)
  })

  it('should throw 404 when photo is not found', async () => {
    photoReadRepo.findById.mockResolvedValueOnce(null)

    const query = new FindSimilarPhotosQuery(photoId)

    await expect(handler.execute(query)).rejects.toThrow('errors.NOT_FOUND')
  })

  it('should return empty array when photo has no embedding', async () => {
    photoReadRepo.findById.mockResolvedValueOnce(existingPhoto)
    prisma.$queryRawUnsafe.mockResolvedValueOnce([]) // no embedding row

    const query = new FindSimilarPhotosQuery(photoId)
    const result = await handler.execute(query)

    expect(result).toEqual([])
  })

  it('should return similar photos with similarity scores', async () => {
    photoReadRepo.findById.mockResolvedValueOnce(existingPhoto)

    // First call: check embedding exists
    prisma.$queryRawUnsafe.mockResolvedValueOnce([{ embedding: 'exists' }])

    // Second call: similarity search
    prisma.$queryRawUnsafe.mockResolvedValueOnce([
      {
        id: 'aaa-111',
        filename: 'IMG_002.jpg',
        storage_key: `events/${eventId}/def-IMG_002.jpg`,
        similarity: 0.95,
        has_classifications: true,
      },
      {
        id: 'bbb-222',
        filename: 'IMG_003.jpg',
        storage_key: `events/${eventId}/ghi-IMG_003.jpg`,
        similarity: 0.87,
        has_classifications: false,
      },
    ])

    const query = new FindSimilarPhotosQuery(photoId, 5)
    const result = await handler.execute(query)

    expect(result).toHaveLength(2)
    expect(result[0]).toEqual({
      id: 'aaa-111',
      filename: 'IMG_002.jpg',
      storageKey: `events/${eventId}/def-IMG_002.jpg`,
      similarity: 0.95,
      hasClassifications: true,
    })
    expect(result[1]).toEqual({
      id: 'bbb-222',
      filename: 'IMG_003.jpg',
      storageKey: `events/${eventId}/ghi-IMG_003.jpg`,
      similarity: 0.87,
      hasClassifications: false,
    })
  })
})
