import { CorrectionTargetType } from '@generated/prisma/client'
import { Photo } from '@photos/domain/entities'
import { EventScope } from '@shared/authorization/domain/event-scope.vo'
import type { IAuthorizationService } from '@shared/authorization/domain/ports/authorization.service.port'
import { AppException } from '@shared/domain'
import { ApplyColorCorrectionCommand } from './apply-color-correction.command'
import { ApplyColorCorrectionHandler } from './apply-color-correction.handler'

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

describe('ApplyColorCorrectionHandler', () => {
  let handler: ApplyColorCorrectionHandler
  let photoReadRepo: any
  let colorRepo: any
  let correctionRepo: any

  let authz: jest.Mocked<Pick<IAuthorizationService, 'resolveEventScope' | 'assert'>>
  const scope = EventScope.unrestricted()

  beforeEach(() => {
    photoReadRepo = { findById: jest.fn(), findByIdInScope: jest.fn() }
    colorRepo = { findById: jest.fn(), save: jest.fn() }
    correctionRepo = {
      appendCorrection: jest.fn(),
      findLatestForTarget: jest.fn(),
      findLatestByTargets: jest.fn(),
    }
    authz = {
      resolveEventScope: jest.fn().mockResolvedValue(scope),
      assert: jest.fn().mockResolvedValue(undefined),
    }
    const freeze = { assertNotFrozen: jest.fn().mockResolvedValue(undefined) }
    handler = new ApplyColorCorrectionHandler(
      photoReadRepo,
      colorRepo,
      correctionRepo,
      authz as never,
      freeze as never,
    )
  })

  it('throws when photo missing (including out-of-scope)', async () => {
    photoReadRepo.findByIdInScope.mockResolvedValue(null)
    await expect(
      handler.execute(
        new ApplyColorCorrectionCommand('p-x', 'c-1', 'primary_color', 'rojo', 'r-1'),
      ),
    ).rejects.toBeInstanceOf(AppException)
    expect(authz.assert).not.toHaveBeenCalled()
  })

  it('rejects when the caller lacks photo.color.correct for this event', async () => {
    photoReadRepo.findByIdInScope.mockResolvedValue(buildPhoto())
    authz.assert.mockRejectedValueOnce(new Error('Insufficient permissions'))
    await expect(
      handler.execute(
        new ApplyColorCorrectionCommand('p-1', 'c-1', 'primary_color', 'rojo', 'r-1'),
      ),
    ).rejects.toThrow('Insufficient permissions')
    expect(colorRepo.save).not.toHaveBeenCalled()
  })

  it('throws when status=processing', async () => {
    photoReadRepo.findByIdInScope.mockResolvedValue(buildPhoto('processing'))
    await expect(
      handler.execute(
        new ApplyColorCorrectionCommand('p-1', 'c-1', 'primary_color', 'rojo', 'r-1'),
      ),
    ).rejects.toBeInstanceOf(AppException)
  })

  it('throws when color does not belong to photo', async () => {
    photoReadRepo.findByIdInScope.mockResolvedValue(buildPhoto())
    colorRepo.findById.mockResolvedValue({
      id: 'c-1',
      photoId: 'OTHER',
      primaryColor: 'rojo',
      secondaryColor: null,
    })
    await expect(
      handler.execute(
        new ApplyColorCorrectionCommand('p-1', 'c-1', 'primary_color', 'azul', 'r-1'),
      ),
    ).rejects.toBeInstanceOf(AppException)
  })

  it('applies primary_color correction when value differs', async () => {
    const photo = buildPhoto()
    photoReadRepo.findByIdInScope.mockResolvedValue(photo)
    colorRepo.findById.mockResolvedValue({
      id: 'c-1',
      photoId: 'p-1',
      primaryColor: 'rojo',
      secondaryColor: null,
    })
    correctionRepo.findLatestForTarget.mockResolvedValue(null)
    correctionRepo.appendCorrection.mockResolvedValue({ id: 'corr-1' })

    const result = await handler.execute(
      new ApplyColorCorrectionCommand('p-1', 'c-1', 'primary_color', 'azul', 'r-1'),
    )
    expect(result).toEqual({ changed: true, correctionId: 'corr-1' })
    expect(correctionRepo.appendCorrection).toHaveBeenCalledWith({
      photoId: 'p-1',
      targetType: CorrectionTargetType.photo_color,
      targetId: 'c-1',
      field: 'primary_color',
      oldValue: 'rojo',
      newValue: 'azul',
      reviewerId: 'r-1',
    })
  })

  it('applies secondary_color correction with null (removal)', async () => {
    const photo = buildPhoto()
    photoReadRepo.findByIdInScope.mockResolvedValue(photo)
    colorRepo.findById.mockResolvedValue({
      id: 'c-1',
      photoId: 'p-1',
      primaryColor: 'rojo',
      secondaryColor: 'azul',
    })
    correctionRepo.findLatestForTarget.mockResolvedValue(null)
    correctionRepo.appendCorrection.mockResolvedValue({ id: 'corr-2' })

    const result = await handler.execute(
      new ApplyColorCorrectionCommand('p-1', 'c-1', 'secondary_color', null, 'r-1'),
    )
    expect(result).toEqual({ changed: true, correctionId: 'corr-2' })
    expect(correctionRepo.appendCorrection).toHaveBeenCalledWith(
      expect.objectContaining({
        field: 'secondary_color',
        oldValue: 'azul',
        newValue: null,
      }),
    )
  })

  it('no-op when secondary_color already null and newValue null', async () => {
    const photo = buildPhoto()
    photoReadRepo.findByIdInScope.mockResolvedValue(photo)
    colorRepo.findById.mockResolvedValue({
      id: 'c-1',
      photoId: 'p-1',
      primaryColor: 'rojo',
      secondaryColor: null,
    })
    correctionRepo.findLatestForTarget.mockResolvedValue(null)

    const result = await handler.execute(
      new ApplyColorCorrectionCommand('p-1', 'c-1', 'secondary_color', null, 'r-1'),
    )
    expect(result).toEqual({ changed: false })
    expect(correctionRepo.appendCorrection).not.toHaveBeenCalled()
    expect(photo.status).toBe('processed')
    expect(photo.reviewedAt).toBeNull()
  })

  it('uses latest correction newValue as effective when present', async () => {
    photoReadRepo.findByIdInScope.mockResolvedValue(buildPhoto())
    colorRepo.findById.mockResolvedValue({
      id: 'c-1',
      photoId: 'p-1',
      primaryColor: 'rojo',
      secondaryColor: null,
    })
    correctionRepo.findLatestForTarget.mockResolvedValue({
      id: 'c-prev',
      newValue: 'verde',
      oldValue: 'rojo',
      correctedAt: new Date(),
      reviewerId: 'r-1',
    })
    correctionRepo.appendCorrection.mockResolvedValue({ id: 'c-new' })

    await handler.execute(
      new ApplyColorCorrectionCommand('p-1', 'c-1', 'primary_color', 'azul', 'r-1'),
    )
    expect(correctionRepo.appendCorrection).toHaveBeenCalledWith(
      expect.objectContaining({ oldValue: 'verde', newValue: 'azul' }),
    )
  })
})
