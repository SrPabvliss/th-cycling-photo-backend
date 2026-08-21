import { CorrectionTargetType } from '@generated/prisma/client'
import { Photo } from '@photos/domain/entities'
import { EventScope } from '@shared/authorization/domain/event-scope.vo'
import type { IAuthorizationService } from '@shared/authorization/domain/ports/authorization.service.port'
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
  let bibRepo: any
  let correctionRepo: any
  let authz: jest.Mocked<Pick<IAuthorizationService, 'resolveEventScope' | 'assert'>>
  const scope = EventScope.unrestricted()

  beforeEach(() => {
    photoReadRepo = { findById: jest.fn(), findByIdInScope: jest.fn() }
    bibRepo = { findById: jest.fn(), save: jest.fn() }
    correctionRepo = {
      appendCorrection: jest.fn(),
      findLatestForTarget: jest.fn(),
      findLatestByTargets: jest.fn(),
    }
    authz = {
      resolveEventScope: jest.fn().mockResolvedValue(scope),
      assert: jest.fn().mockResolvedValue(undefined),
    }
    handler = new ApplyBibCorrectionHandler(photoReadRepo, bibRepo, correctionRepo, authz as never)
  })

  it('throws when photo missing (including out-of-scope)', async () => {
    photoReadRepo.findByIdInScope.mockResolvedValue(null)
    await expect(
      handler.execute(new ApplyBibCorrectionCommand('p-x', 'b-1', '42', 'r-1')),
    ).rejects.toBeInstanceOf(AppException)
    expect(authz.resolveEventScope).toHaveBeenCalledWith('r-1')
    expect(photoReadRepo.findByIdInScope).toHaveBeenCalledWith('p-x', scope)
    expect(authz.assert).not.toHaveBeenCalled()
  })

  it('rejects when the caller lacks photo.bib.correct for this event', async () => {
    photoReadRepo.findByIdInScope.mockResolvedValue(buildPhoto())
    authz.assert.mockRejectedValueOnce(new Error('Insufficient permissions'))
    await expect(
      handler.execute(new ApplyBibCorrectionCommand('p-1', 'b-1', '42', 'r-1')),
    ).rejects.toThrow('Insufficient permissions')
    expect(bibRepo.save).not.toHaveBeenCalled()
  })

  it('throws when status=processing', async () => {
    photoReadRepo.findByIdInScope.mockResolvedValue(buildPhoto('processing'))
    await expect(
      handler.execute(new ApplyBibCorrectionCommand('p-1', 'b-1', '42', 'r-1')),
    ).rejects.toBeInstanceOf(AppException)
  })

  it('throws when bib does not belong to photo', async () => {
    photoReadRepo.findByIdInScope.mockResolvedValue(buildPhoto())
    bibRepo.findById.mockResolvedValue({ id: 'b-1', photoId: 'OTHER', digits: '20' })
    await expect(
      handler.execute(new ApplyBibCorrectionCommand('p-1', 'b-1', '42', 'r-1')),
    ).rejects.toBeInstanceOf(AppException)
  })

  it('throws when newValue fails regex', async () => {
    photoReadRepo.findByIdInScope.mockResolvedValue(buildPhoto())
    bibRepo.findById.mockResolvedValue({ id: 'b-1', photoId: 'p-1', digits: '20' })
    await expect(
      handler.execute(new ApplyBibCorrectionCommand('p-1', 'b-1', 'abc', 'r-1')),
    ).rejects.toBeInstanceOf(AppException)
  })

  it('no-op when newValue equals effective value', async () => {
    const photo = buildPhoto()
    photoReadRepo.findByIdInScope.mockResolvedValue(photo)
    bibRepo.findById.mockResolvedValue({ id: 'b-1', photoId: 'p-1', digits: '42' })
    correctionRepo.findLatestForTarget.mockResolvedValue(null)

    const result = await handler.execute(new ApplyBibCorrectionCommand('p-1', 'b-1', '42', 'r-1'))
    expect(result).toEqual({ changed: false })
    expect(correctionRepo.appendCorrection).not.toHaveBeenCalled()
    expect(photo.status).toBe('processed')
    expect(photo.reviewedAt).toBeNull()
  })

  it('applies correction when newValue differs', async () => {
    const photo = buildPhoto()
    photoReadRepo.findByIdInScope.mockResolvedValue(photo)
    bibRepo.findById.mockResolvedValue({ id: 'b-1', photoId: 'p-1', digits: '20' })
    correctionRepo.findLatestForTarget.mockResolvedValue(null)
    correctionRepo.appendCorrection.mockResolvedValue({ id: 'c-1' })

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
    photoReadRepo.findByIdInScope.mockResolvedValue(buildPhoto())
    bibRepo.findById.mockResolvedValue({ id: 'b-1', photoId: 'p-1', digits: '20' })
    correctionRepo.findLatestForTarget.mockResolvedValue({
      id: 'c-prev',
      newValue: '30',
      oldValue: '20',
      correctedAt: new Date(),
      reviewerId: 'r-1',
    })
    correctionRepo.appendCorrection.mockResolvedValue({ id: 'c-new' })

    await handler.execute(new ApplyBibCorrectionCommand('p-1', 'b-1', '42', 'r-1'))
    expect(correctionRepo.appendCorrection).toHaveBeenCalledWith(
      expect.objectContaining({ oldValue: '30', newValue: '42' }),
    )
  })
})
