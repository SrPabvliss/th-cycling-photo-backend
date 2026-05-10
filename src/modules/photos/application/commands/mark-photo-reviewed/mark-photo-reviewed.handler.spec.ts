import { Photo } from '@photos/domain/entities'
import { AppException } from '@shared/domain'
import { MarkPhotoReviewedCommand } from './mark-photo-reviewed.command'
import { MarkPhotoReviewedHandler } from './mark-photo-reviewed.handler'

const buildPhoto = (status: any = 'processed', reviewedAt: Date | null = null) =>
  Photo.fromPersistence({
    id: 'p-1',
    eventId: 'e-1',
    filename: 'a.jpg',
    storageKey: 'k',
    fileSize: 1n,
    mimeType: 'image/jpeg',
    width: 10,
    height: 10,
    status,
    capturedAt: null,
    uploadedAt: new Date(),
    processedAt: new Date(),
    reviewedAt,
    publicSlug: 's',
    retouchedStorageKey: null,
    retouchedPublicSlug: null,
    retouchedFileSize: null,
    retouchedAt: null,
  })

describe('MarkPhotoReviewedHandler', () => {
  let handler: MarkPhotoReviewedHandler
  let photoReadRepo: any
  let photoWriteRepo: any

  beforeEach(() => {
    photoReadRepo = { findById: jest.fn() }
    photoWriteRepo = { save: jest.fn() }
    handler = new MarkPhotoReviewedHandler(photoReadRepo, photoWriteRepo)
  })

  it('throws when photo missing', async () => {
    photoReadRepo.findById.mockResolvedValue(null)
    await expect(
      handler.execute(new MarkPhotoReviewedCommand('p-x', 'r-1')),
    ).rejects.toBeInstanceOf(AppException)
  })

  it('throws when status=processing', async () => {
    photoReadRepo.findById.mockResolvedValue(buildPhoto('processing'))
    await expect(
      handler.execute(new MarkPhotoReviewedCommand('p-1', 'r-1')),
    ).rejects.toBeInstanceOf(AppException)
  })

  it('idempotent — already reviewed photo still saves and returns reviewedAt', async () => {
    const prev = new Date('2024-01-01')
    const photo = buildPhoto('reviewed', prev)
    photoReadRepo.findById.mockResolvedValue(photo)
    photoWriteRepo.save.mockResolvedValue(photo)

    const result = await handler.execute(new MarkPhotoReviewedCommand('p-1', 'r-1'))
    expect(result.photoId).toBe('p-1')
    expect(result.reviewedAt).toBeInstanceOf(Date)
    expect(photoWriteRepo.save).toHaveBeenCalled()
  })

  it('happy path marks photo reviewed and saves', async () => {
    const photo = buildPhoto()
    photoReadRepo.findById.mockResolvedValue(photo)
    photoWriteRepo.save.mockResolvedValue(photo)

    const result = await handler.execute(new MarkPhotoReviewedCommand('p-1', 'r-1'))
    expect(photo.status).toBe('reviewed')
    expect(photo.reviewedAt).toBeInstanceOf(Date)
    expect(result.photoId).toBe('p-1')
  })
})
