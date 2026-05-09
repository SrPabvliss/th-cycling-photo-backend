import { CorrectionTargetType } from '@generated/prisma/client'
import { Photo } from '@photos/domain/entities'
import { AppException } from '@shared/domain'
import { ApplyBibCorrectionCommand } from './apply-bib-correction.command'
import { ApplyBibCorrectionHandler } from './apply-bib-correction.handler'

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

describe('ApplyBibCorrectionHandler', () => {
  let handler: ApplyBibCorrectionHandler
  let photoReadRepo: any
  let photoWriteRepo: any
  let bibRepo: any
  let correctionRepo: any

  beforeEach(() => {
    photoReadRepo = { findById: jest.fn() }
    photoWriteRepo = { save: jest.fn() }
    bibRepo = { findById: jest.fn(), save: jest.fn() }
    correctionRepo = {
      appendCorrection: jest.fn(),
      findLatestForTarget: jest.fn(),
      findLatestByTargets: jest.fn(),
    }
    handler = new ApplyBibCorrectionHandler(photoReadRepo, photoWriteRepo, bibRepo, correctionRepo)
  })

  it('throws when photo missing', async () => {
    photoReadRepo.findById.mockResolvedValue(null)
    await expect(
      handler.execute(new ApplyBibCorrectionCommand('p-x', 'b-1', '42', 'r-1')),
    ).rejects.toBeInstanceOf(AppException)
  })

  it('throws when status=processing', async () => {
    photoReadRepo.findById.mockResolvedValue(buildPhoto('processing'))
    await expect(
      handler.execute(new ApplyBibCorrectionCommand('p-1', 'b-1', '42', 'r-1')),
    ).rejects.toBeInstanceOf(AppException)
  })

  it('throws when bib does not belong to photo', async () => {
    photoReadRepo.findById.mockResolvedValue(buildPhoto())
    bibRepo.findById.mockResolvedValue({ id: 'b-1', photoId: 'OTHER', digits: '20' })
    await expect(
      handler.execute(new ApplyBibCorrectionCommand('p-1', 'b-1', '42', 'r-1')),
    ).rejects.toBeInstanceOf(AppException)
  })

  it('throws when newValue fails regex', async () => {
    photoReadRepo.findById.mockResolvedValue(buildPhoto())
    bibRepo.findById.mockResolvedValue({ id: 'b-1', photoId: 'p-1', digits: '20' })
    await expect(
      handler.execute(new ApplyBibCorrectionCommand('p-1', 'b-1', 'abc', 'r-1')),
    ).rejects.toBeInstanceOf(AppException)
  })

  it('no-op when newValue equals effective value', async () => {
    const photo = buildPhoto()
    photoReadRepo.findById.mockResolvedValue(photo)
    bibRepo.findById.mockResolvedValue({ id: 'b-1', photoId: 'p-1', digits: '42' })
    correctionRepo.findLatestForTarget.mockResolvedValue(null)
    photoWriteRepo.save.mockResolvedValue(photo)

    const result = await handler.execute(new ApplyBibCorrectionCommand('p-1', 'b-1', '42', 'r-1'))
    expect(result).toEqual({ changed: false })
    expect(correctionRepo.appendCorrection).not.toHaveBeenCalled()
    expect(photoWriteRepo.save).toHaveBeenCalled()
    expect(photo.status).toBe('reviewed')
    expect(photo.reviewedAt).toBeInstanceOf(Date)
  })

  it('applies correction when newValue differs', async () => {
    const photo = buildPhoto()
    photoReadRepo.findById.mockResolvedValue(photo)
    bibRepo.findById.mockResolvedValue({ id: 'b-1', photoId: 'p-1', digits: '20' })
    correctionRepo.findLatestForTarget.mockResolvedValue(null)
    correctionRepo.appendCorrection.mockResolvedValue({ id: 'c-1' })
    photoWriteRepo.save.mockResolvedValue(photo)

    const result = await handler.execute(new ApplyBibCorrectionCommand('p-1', 'b-1', '42', 'r-1'))
    expect(result).toEqual({ changed: true, correctionId: 'c-1' })
    expect(correctionRepo.appendCorrection).toHaveBeenCalledWith({
      photoId: 'p-1',
      targetType: CorrectionTargetType.photo_bib,
      targetId: 'b-1',
      field: 'digits',
      oldValue: '20',
      newValue: '42',
      reviewerId: 'r-1',
    })
  })

  it('uses latest correction newValue as effective when present', async () => {
    photoReadRepo.findById.mockResolvedValue(buildPhoto())
    bibRepo.findById.mockResolvedValue({ id: 'b-1', photoId: 'p-1', digits: '20' })
    correctionRepo.findLatestForTarget.mockResolvedValue({
      id: 'c-prev',
      newValue: '30',
      oldValue: '20',
      correctedAt: new Date(),
      reviewerId: 'r-1',
    })
    correctionRepo.appendCorrection.mockResolvedValue({ id: 'c-new' })
    photoWriteRepo.save.mockResolvedValue(buildPhoto())

    await handler.execute(new ApplyBibCorrectionCommand('p-1', 'b-1', '42', 'r-1'))
    expect(correctionRepo.appendCorrection).toHaveBeenCalledWith(
      expect.objectContaining({ oldValue: '30', newValue: '42' }),
    )
  })
})
