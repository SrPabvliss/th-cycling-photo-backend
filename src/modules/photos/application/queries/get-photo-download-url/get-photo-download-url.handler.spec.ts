import { Photo } from '@photos/domain/entities'
import type { IPhotoReadRepository } from '@photos/domain/ports'
import { EventScope } from '@shared/authorization/domain/event-scope.vo'
import type { IAuthorizationService } from '@shared/authorization/domain/ports/authorization.service.port'
import { AppException } from '@shared/domain'
import type { IStorageAdapter } from '@shared/storage/domain/ports/storage-adapter.port'
import { GetPhotoDownloadUrlHandler } from './get-photo-download-url.handler'
import { GetPhotoDownloadUrlQuery } from './get-photo-download-url.query'

describe('GetPhotoDownloadUrlHandler', () => {
  let handler: GetPhotoDownloadUrlHandler
  let photoReadRepo: jest.Mocked<IPhotoReadRepository>
  let storageAdapter: jest.Mocked<IStorageAdapter>
  let authz: jest.Mocked<IAuthorizationService>
  const scope = EventScope.unrestricted()

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
      status: 'processed',
      capturedAt: null,
      uploadedAt: new Date(),
      processedAt: new Date(),
      reviewedAt: null,
      publicSlug: 'test-slug',
      retouchedStorageKey: withRetouched ? retouchedKey : null,
      retouchedPublicSlug: withRetouched ? 'retouched-slug' : null,
      retouchedFileSize: withRetouched ? 3000n : null,
      retouchedAt: withRetouched ? new Date() : null,
    })

  beforeEach(() => {
    photoReadRepo = {
      findById: jest.fn(),
      findByIdInScope: jest.fn(),
      existsByEventAndFilename: jest.fn(),
      getPhotosList: jest.fn(),
      getGalleryFacets: jest.fn(),
      getPhotoDetail: jest.fn(),
      getPhotoDetailBySlug: jest.fn(),
      getPhotoViewBySlug: jest.fn(),
      searchPhotos: jest.fn(),
      getTotalFileSizeByEvent: jest.fn(),
      getTotalFileSizesByEventIds: jest.fn(),
      getClassifiedCountByEvent: jest.fn(),
      getClassifiedCountsByEventIds: jest.fn(),
      getAllPhotoKeysForEvent: jest.fn(),
      getResumePoint: jest.fn(),
      getDistinctEventIdsForPhotoIds: jest.fn(),
      countAll: jest.fn(),
      countPendingReview: jest.fn(),
      sumAllFileSize: jest.fn(),
      countByIds: jest.fn(),
      findSimilar: jest.fn(),
      countByIdsAndEvent: jest.fn(),
      getReviewQueue: jest.fn(),
      getReviewQueueByEventIds: jest.fn(),
    } as jest.Mocked<IPhotoReadRepository>

    storageAdapter = {
      upload: jest.fn(),
      download: jest.fn(),
      getPresignedUrl: jest.fn(),
      getPresignedDownloadUrl: jest.fn(),
      getPublicUrl: jest.fn(),
      delete: jest.fn(),
    } as jest.Mocked<IStorageAdapter>

    authz = {
      can: jest.fn(),
      assert: jest.fn().mockResolvedValue(undefined),
      resolveEventScope: jest.fn().mockResolvedValue(scope),
    } as jest.Mocked<IAuthorizationService>

    handler = new GetPhotoDownloadUrlHandler(photoReadRepo, storageAdapter, authz)
  })

  it('should throw NOT_FOUND when photo does not exist', async () => {
    photoReadRepo.findByIdInScope.mockResolvedValueOnce(null)

    const query = new GetPhotoDownloadUrlQuery('non-existent', 'original', 'u1')

    const error = await handler.execute(query).catch((e) => e)
    expect(error).toBeInstanceOf(AppException)
    expect(error.code).toBe('NOT_FOUND')
  })

  it('should throw NOT_FOUND when the photo exists but its event is outside the caller scope', async () => {
    // The repository is what enforces this — findByIdInScope returns null
    // for an out-of-scope id exactly as it would for an unknown one.
    const restrictedScope = new EventScope(false, ['other-tenant'], [])
    authz.resolveEventScope.mockResolvedValueOnce(restrictedScope)
    photoReadRepo.findByIdInScope.mockResolvedValueOnce(null)

    const query = new GetPhotoDownloadUrlQuery('photo-001', 'original', 'u2')

    const error = await handler.execute(query).catch((e) => e)
    expect(error).toBeInstanceOf(AppException)
    expect(error.code).toBe('NOT_FOUND')
    expect(photoReadRepo.findByIdInScope).toHaveBeenCalledWith('photo-001', restrictedScope)
    expect(authz.assert).not.toHaveBeenCalled()
  })

  it('should return presigned download URL for original photo', async () => {
    photoReadRepo.findByIdInScope.mockResolvedValueOnce(createPhoto())
    storageAdapter.getPresignedDownloadUrl.mockResolvedValueOnce(
      'https://s3.us-west-004.backblazeb2.com/file/bucket/events/550e8400/photos/abc-original.jpg?signed=1',
    )

    const query = new GetPhotoDownloadUrlQuery('photo-001', 'original', 'u1')
    const result = await handler.execute(query)

    expect(result.url).toBe(
      'https://s3.us-west-004.backblazeb2.com/file/bucket/events/550e8400/photos/abc-original.jpg?signed=1',
    )
    expect(storageAdapter.getPresignedDownloadUrl).toHaveBeenCalledWith({
      key: originalKey,
      filename: 'original.jpg',
    })
    expect(authz.assert).toHaveBeenCalledWith('u1', 'photo.download', eventId)
  })

  it('should return presigned download URL for retouched photo', async () => {
    photoReadRepo.findByIdInScope.mockResolvedValueOnce(createPhoto(true))
    storageAdapter.getPresignedDownloadUrl.mockResolvedValueOnce(
      'https://s3.us-west-004.backblazeb2.com/file/bucket/events/550e8400/retouched/def-retouched.jpg?signed=1',
    )

    const query = new GetPhotoDownloadUrlQuery('photo-001', 'retouched', 'u1')
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
    photoReadRepo.findByIdInScope.mockResolvedValueOnce(createPhoto(false))

    const query = new GetPhotoDownloadUrlQuery('photo-001', 'retouched', 'u1')

    const error = await handler.execute(query).catch((e) => e)
    expect(error).toBeInstanceOf(AppException)
    expect(error.code).toBe('NOT_FOUND')
  })

  it('rejects when the caller lacks photo.download for this event', async () => {
    photoReadRepo.findByIdInScope.mockResolvedValueOnce(createPhoto())
    authz.assert.mockRejectedValueOnce(new Error('Insufficient permissions'))

    const query = new GetPhotoDownloadUrlQuery('photo-001', 'original', 'u1')

    await expect(handler.execute(query)).rejects.toThrow('Insufficient permissions')
    expect(storageAdapter.getPresignedDownloadUrl).not.toHaveBeenCalled()
  })
})
