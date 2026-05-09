import { ColorRegion } from '@generated/prisma/client'
import { Photo } from '@photos/domain/entities'
import { AppException } from '@shared/domain'
import { AddPhotoColorCommand } from './add-photo-color.command'
import { AddPhotoColorHandler } from './add-photo-color.handler'

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

describe('AddPhotoColorHandler', () => {
  let handler: AddPhotoColorHandler
  let photoReadRepo: any
  let colorRepo: any

  beforeEach(() => {
    photoReadRepo = { findById: jest.fn() }
    colorRepo = { findById: jest.fn(), save: jest.fn() }
    handler = new AddPhotoColorHandler(photoReadRepo, colorRepo)
  })

  it('throws when photo missing', async () => {
    photoReadRepo.findById.mockResolvedValue(null)
    await expect(
      handler.execute(new AddPhotoColorCommand('p-x', ColorRegion.helmet, 'rojo', null, 'r-1')),
    ).rejects.toBeInstanceOf(AppException)
  })

  it('throws when status=processing', async () => {
    photoReadRepo.findById.mockResolvedValue(buildPhoto('processing'))
    await expect(
      handler.execute(new AddPhotoColorCommand('p-1', ColorRegion.helmet, 'rojo', null, 'r-1')),
    ).rejects.toBeInstanceOf(AppException)
  })

  it('happy path persists manual color and does NOT auto-mark photo reviewed', async () => {
    const photo = buildPhoto('processed', null)
    const initialStatus = photo.status
    const initialReviewedAt = photo.reviewedAt
    photoReadRepo.findById.mockResolvedValue(photo)
    colorRepo.save.mockImplementation((c: any) => Promise.resolve(c))

    const result = await handler.execute(
      new AddPhotoColorCommand('p-1', ColorRegion.helmet, 'rojo', 'azul', 'r-1'),
    )

    expect(result.photoId).toBe('p-1')
    expect(result.colorId).toBeDefined()
    expect(colorRepo.save).toHaveBeenCalled()
    expect(photo.status).toBe(initialStatus)
    expect(photo.reviewedAt).toBe(initialReviewedAt)
  })
})
