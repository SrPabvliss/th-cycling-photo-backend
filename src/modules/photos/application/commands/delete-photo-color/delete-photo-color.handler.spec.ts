import { Photo } from '@photos/domain/entities'
import { EventScope } from '@shared/authorization/domain/event-scope.vo'
import type { IAuthorizationService } from '@shared/authorization/domain/ports/authorization.service.port'
import { AppException } from '@shared/domain'
import { DeletePhotoColorCommand } from './delete-photo-color.command'
import { DeletePhotoColorHandler } from './delete-photo-color.handler'

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

const buildColor = (overrides: Partial<Record<string, unknown>> = {}) => ({
  id: 'c-1',
  photoId: 'p-1',
  region: 'jersey',
  primaryColor: 'red',
  secondaryColor: null,
  ...overrides,
})

describe('DeletePhotoColorHandler', () => {
  let handler: DeletePhotoColorHandler
  let photoReadRepo: any
  let colorRepo: any
  let loggerSpy: jest.SpyInstance

  let authz: jest.Mocked<Pick<IAuthorizationService, 'resolveEventScope' | 'assert'>>
  const scope = EventScope.unrestricted()

  beforeEach(() => {
    photoReadRepo = { findById: jest.fn(), findByIdInScope: jest.fn() }
    colorRepo = { findById: jest.fn(), save: jest.fn(), softDelete: jest.fn() }
    authz = {
      resolveEventScope: jest.fn().mockResolvedValue(scope),
      assert: jest.fn().mockResolvedValue(undefined),
    }
    const freeze = { assertNotFrozen: jest.fn().mockResolvedValue(undefined) }
    handler = new DeletePhotoColorHandler(photoReadRepo, colorRepo, authz as never, freeze as never)
    loggerSpy = jest.spyOn((handler as any).logger, 'log').mockImplementation(() => undefined)
  })

  afterEach(() => {
    loggerSpy.mockRestore()
  })

  it('happy path: returns { colorId, photoId }, calls softDelete, emits audit log with region', async () => {
    photoReadRepo.findByIdInScope.mockResolvedValue(buildPhoto())
    colorRepo.findById.mockResolvedValue(buildColor({ region: 'jersey' }))
    colorRepo.softDelete.mockResolvedValue(undefined)

    const result = await handler.execute(new DeletePhotoColorCommand('p-1', 'c-1', 'r-1'))

    expect(result).toEqual({ colorId: 'c-1', photoId: 'p-1' })
    expect(authz.assert).toHaveBeenCalledWith('r-1', 'photo.color.delete', 'e-1')
    expect(colorRepo.softDelete).toHaveBeenCalledWith('c-1', 'r-1')
    expect(loggerSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'photo_attribute_soft_deleted',
        photo_id: 'p-1',
        reviewer_id: 'r-1',
        attribute_type: 'photo_color',
        attribute_id: 'c-1',
        payload: { region: 'jersey' },
      }),
    )
  })

  it('throws when photo missing (including out-of-scope)', async () => {
    photoReadRepo.findByIdInScope.mockResolvedValue(null)
    await expect(
      handler.execute(new DeletePhotoColorCommand('p-x', 'c-1', 'r-1')),
    ).rejects.toBeInstanceOf(AppException)
    expect(colorRepo.softDelete).not.toHaveBeenCalled()
    expect(authz.assert).not.toHaveBeenCalled()
  })

  it('rejects when the caller lacks photo.color.delete for this event', async () => {
    photoReadRepo.findByIdInScope.mockResolvedValue(buildPhoto())
    authz.assert.mockRejectedValueOnce(new Error('Insufficient permissions'))
    await expect(handler.execute(new DeletePhotoColorCommand('p-1', 'c-1', 'r-1'))).rejects.toThrow(
      'Insufficient permissions',
    )
    expect(colorRepo.softDelete).not.toHaveBeenCalled()
  })

  it('throws when status=processing', async () => {
    photoReadRepo.findByIdInScope.mockResolvedValue(buildPhoto('processing'))
    await expect(
      handler.execute(new DeletePhotoColorCommand('p-1', 'c-1', 'r-1')),
    ).rejects.toBeInstanceOf(AppException)
    expect(colorRepo.softDelete).not.toHaveBeenCalled()
  })

  it('throws when color not found', async () => {
    photoReadRepo.findByIdInScope.mockResolvedValue(buildPhoto())
    colorRepo.findById.mockResolvedValue(null)
    await expect(
      handler.execute(new DeletePhotoColorCommand('p-1', 'c-1', 'r-1')),
    ).rejects.toBeInstanceOf(AppException)
    expect(colorRepo.softDelete).not.toHaveBeenCalled()
  })

  it('throws when color belongs to another photo', async () => {
    photoReadRepo.findByIdInScope.mockResolvedValue(buildPhoto())
    colorRepo.findById.mockResolvedValue(buildColor({ photoId: 'OTHER' }))
    await expect(
      handler.execute(new DeletePhotoColorCommand('p-1', 'c-1', 'r-1')),
    ).rejects.toBeInstanceOf(AppException)
    expect(colorRepo.softDelete).not.toHaveBeenCalled()
  })
})
