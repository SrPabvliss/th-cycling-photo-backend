import { Photo } from '@photos/domain/entities'
import type { IPhotoReadRepository } from '@photos/domain/ports'
import { AppException } from '@shared/domain'
import type { IStorageAdapter } from '@shared/storage/domain/ports/storage-adapter.port'
import { GetPhotoDownloadUrlHandler } from './get-photo-download-url.handler'
import { GetPhotoDownloadUrlQuery } from './get-photo-download-url.query'

describe('GetPhotoDownloadUrlHandler', () => {
  let handler: GetPhotoDownloadUrlHandler
  let photoReadRepo: jest.Mocked<IPhotoReadRepository>
  let storageAdapter: jest.Mocked<IStorageAdapter>

  const eventId = '550e8400-e29b-41d4-a716-446655440000'
  const originalKey = `events/${eventId}/photos/abc-original.jpg`
  const retouchedKey = `events/${eventId}/retouched/def-retouched.jpg`

  const createPhoto = (withRetouched = false) =>
    Photo.fromPersistence({
      id: 'photo-001',
      eventId,
      filename: 'original.jpg',
      storageKey: originalKey,
      fileSize: 2048n,
      mimeType: 'image/jpeg',
      width: 1920,
      height: 1080,
      status: 'completed',
      unclassifiedReason: null,
      capturedAt: null,
      uploadedAt: new Date(),
      processedAt: new Date(),
      publicSlug: 'test-slug',
      retouchedStorageKey: withRetouched ? retouchedKey : null,
      retouchedFileSize: withRetouched ? 3000n : null,
      retouchedAt: withRetouched ? new Date() : null,
    })

  beforeEach(() => {
    photoReadRepo = {
      findById: jest.fn(),
      existsByEventAndFilename: jest.fn(),
      getPhotosList: jest.fn(),
      getPhotoDetail: jest.fn(),
      searchPhotos: jest.fn(),
      getTotalFileSizeByEvent: jest.fn(),
      getTotalFileSizesByEventIds: jest.fn(),
      getClassifiedCountByEvent: jest.fn(),
      getClassifiedCountsByEventIds: jest.fn(),
      getAllPhotoKeysForEvent: jest.fn(),
      getResumePoint: jest.fn(),
      countAll: jest.fn(),
      sumAllFileSize: jest.fn(),
      countByIds: jest.fn(),
      findSimilar: jest.fn(),
      countByIdsAndEvent: jest.fn(),
    } as jest.Mocked<IPhotoReadRepository>

    storageAdapter = {
      upload: jest.fn(),
      getPresignedUrl: jest.fn(),
      getPresignedDownloadUrl: jest.fn(),
      getPublicUrl: jest.fn(),
      delete: jest.fn(),
    } as jest.Mocked<IStorageAdapter>

    handler = new GetPhotoDownloadUrlHandler(photoReadRepo, storageAdapter)
  })

  it('should throw NOT_FOUND when photo does not exist', async () => {
    photoReadRepo.findById.mockResolvedValueOnce(null)

    const query = new GetPhotoDownloadUrlQuery('non-existent', 'original')

    const error = await handler.execute(query).catch((e) => e)
    expect(error).toBeInstanceOf(AppException)
    expect(error.code).toBe('NOT_FOUND')
  })

  it('should return presigned download URL for original photo', async () => {
    photoReadRepo.findById.mockResolvedValueOnce(createPhoto())
    storageAdapter.getPresignedDownloadUrl.mockResolvedValueOnce(
      'https://s3.us-west-004.backblazeb2.com/file/bucket/events/550e8400/photos/abc-original.jpg?signed=1',
    )

    const query = new GetPhotoDownloadUrlQuery('photo-001', 'original')
    const result = await handler.execute(query)

    expect(result.url).toBe(
      'https://s3.us-west-004.backblazeb2.com/file/bucket/events/550e8400/photos/abc-original.jpg?signed=1',
    )
    expect(storageAdapter.getPresignedDownloadUrl).toHaveBeenCalledWith({
      key: originalKey,
      filename: 'original.jpg',
    })
  })

  it('should return presigned download URL for retouched photo', async () => {
    photoReadRepo.findById.mockResolvedValueOnce(createPhoto(true))
    storageAdapter.getPresignedDownloadUrl.mockResolvedValueOnce(
      'https://s3.us-west-004.backblazeb2.com/file/bucket/events/550e8400/retouched/def-retouched.jpg?signed=1',
    )

    const query = new GetPhotoDownloadUrlQuery('photo-001', 'retouched')
    const result = await handler.execute(query)

    expect(result.url).toBe(
      'https://s3.us-west-004.backblazeb2.com/file/bucket/events/550e8400/retouched/def-retouched.jpg?signed=1',
    )
    expect(storageAdapter.getPresignedDownloadUrl).toHaveBeenCalledWith({
      key: retouchedKey,
      filename: 'original.jpg',
    })
  })

  it('should throw NOT_FOUND when requesting retouched but none exists', async () => {
    photoReadRepo.findById.mockResolvedValueOnce(createPhoto(false))

    const query = new GetPhotoDownloadUrlQuery('photo-001', 'retouched')

    const error = await handler.execute(query).catch((e) => e)
    expect(error).toBeInstanceOf(AppException)
    expect(error.code).toBe('NOT_FOUND')
  })
})
