import type { IPhotoReadRepository } from '@photos/domain/ports'
import { EventScope } from '@shared/authorization/domain/event-scope.vo'
import type { IAuthorizationService } from '@shared/authorization/domain/ports/authorization.service.port'
import { AppException } from '@shared/domain'
import { GetPhotoDetailHandler } from './get-photo-detail.handler'
import { GetPhotoDetailQuery } from './get-photo-detail.query'

describe('GetPhotoDetailHandler', () => {
  let handler: GetPhotoDetailHandler
  let readRepo: jest.Mocked<IPhotoReadRepository>
  let authz: jest.Mocked<IAuthorizationService>
  const scope = EventScope.unrestricted()

  const photoDetail = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    eventId: 'event-001',
    filename: 'photo-001.jpg',
    fileSize: 2048000,
    mimeType: 'image/jpeg',
    width: 1920,
    height: 1080,
    status: 'reviewed',
    capturedAt: new Date('2025-06-15T10:30:00Z'),
    uploadedAt: new Date('2025-06-15T12:00:00Z'),
    processedAt: new Date('2025-06-15T12:05:00Z'),
    reviewedAt: null,
    publicSlug: 'test-slug',
    eventSlug: 'test-event',
    imageUrl: 'https://cdn.test/internal/workspace/test-slug.jpg?token=mock',
    thumbnailUrl: 'https://cdn.test/internal/thumb/test-slug.jpg?token=mock',
    retouchedImageUrl: null,
    retouchedFileSize: null,
    retouchedAt: null,
    photoCategoryId: null,
    photoCategoryName: null,
    orders: [],
    position: 1,
    eventPhotoCount: 1,
    previousSlug: null,
    nextSlug: null,
    bibs: [],
    colors: [],
  }

  beforeEach(() => {
    readRepo = {
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

    authz = {
      can: jest.fn(),
      assert: jest.fn(),
      resolveEventScope: jest.fn().mockResolvedValue(scope),
    } as jest.Mocked<IAuthorizationService>

    handler = new GetPhotoDetailHandler(readRepo, authz)
  })

  it('should return photo detail when photo exists', async () => {
    readRepo.getPhotoDetail.mockResolvedValue(photoDetail)

    const query = new GetPhotoDetailQuery(photoDetail.id, 'u1')
    const result = await handler.execute(query)

    expect(result).toEqual(photoDetail)
    expect(authz.resolveEventScope).toHaveBeenCalledWith('u1')
    expect(readRepo.getPhotoDetail).toHaveBeenCalledWith(photoDetail.id, scope)
  })

  it('should throw 404 when photo does not exist', async () => {
    readRepo.getPhotoDetail.mockResolvedValue(null)

    const query = new GetPhotoDetailQuery('non-existent-id', 'u1')

    await expect(handler.execute(query)).rejects.toThrow(AppException)
    expect(readRepo.getPhotoDetail).toHaveBeenCalledWith('non-existent-id', scope)
  })

  it('should throw 404 (not 403) when the photo exists but its event is outside the caller scope', async () => {
    // The repository is the one enforcing this — an out-of-scope id simply
    // does not match the query's nested `event: scope.toPrisma()` filter,
    // so it returns null exactly like an unknown id. This test proves the
    // handler propagates that as a 404 rather than special-casing it.
    readRepo.getPhotoDetail.mockResolvedValue(null)
    const restrictedScope = new EventScope(false, ['t1'], [])
    authz.resolveEventScope.mockResolvedValue(restrictedScope)

    const query = new GetPhotoDetailQuery('out-of-scope-id', 'u2')

    await expect(handler.execute(query)).rejects.toThrow(AppException)
    expect(readRepo.getPhotoDetail).toHaveBeenCalledWith('out-of-scope-id', restrictedScope)
  })
})
