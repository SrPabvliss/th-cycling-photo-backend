import type { IPhotoReadRepository } from '@photos/domain/ports'
import { AppException } from '@shared/domain'
import { GetPhotoDetailHandler } from './get-photo-detail.handler'
import { GetPhotoDetailQuery } from './get-photo-detail.query'

describe('GetPhotoDetailHandler', () => {
  let handler: GetPhotoDetailHandler
  let readRepo: jest.Mocked<IPhotoReadRepository>

  const photoDetail = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    eventId: 'event-001',
    filename: 'photo-001.jpg',
    storageKey: 'events/event-001/photo-001.jpg',
    fileSize: BigInt(2048000),
    mimeType: 'image/jpeg',
    width: 1920,
    height: 1080,
    status: 'classified',
    unclassifiedReason: null,
    capturedAt: new Date('2025-06-15T10:30:00Z'),
    uploadedAt: new Date('2025-06-15T12:00:00Z'),
    processedAt: new Date('2025-06-15T12:05:00Z'),
    detectedCyclists: [],
  }

  beforeEach(() => {
    readRepo = {
      findById: jest.fn(),
      getPhotosList: jest.fn(),
      getPhotoDetail: jest.fn(),
      searchPhotos: jest.fn(),
    } as jest.Mocked<IPhotoReadRepository>

    handler = new GetPhotoDetailHandler(readRepo)
  })

  it('should return photo detail when photo exists', async () => {
    readRepo.getPhotoDetail.mockResolvedValue(photoDetail)

    const query = new GetPhotoDetailQuery(photoDetail.id)
    const result = await handler.execute(query)

    expect(result).toEqual(photoDetail)
    expect(readRepo.getPhotoDetail).toHaveBeenCalledWith(photoDetail.id)
  })

  it('should throw 404 when photo does not exist', async () => {
    readRepo.getPhotoDetail.mockResolvedValue(null)

    const query = new GetPhotoDetailQuery('non-existent-id')

    await expect(handler.execute(query)).rejects.toThrow(AppException)
    expect(readRepo.getPhotoDetail).toHaveBeenCalledWith('non-existent-id')
  })
})
