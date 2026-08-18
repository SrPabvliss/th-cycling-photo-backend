import { Photo } from '@photos/domain/entities'
import { EventScope } from '@shared/authorization/domain/event-scope.vo'
import { AppException } from '@shared/domain'
import { SetPhotoRetouchFlagCommand } from './set-photo-retouch-flag.command'
import { SetPhotoRetouchFlagHandler } from './set-photo-retouch-flag.handler'

const buildPhoto = () =>
  Photo.fromPersistence({
    id: 'p-1',
    eventId: 'e-1',
    filename: 'a.jpg',
    storageKey: 'k',
    fileSize: 1n,
    mimeType: 'image/jpeg',
    width: 10,
    height: 10,
    status: 'processed',
    capturedAt: null,
    uploadedAt: new Date(),
    processedAt: new Date(),
    reviewedAt: null,
    publicSlug: 's',
    retouchedStorageKey: null,
    retouchedPublicSlug: null,
    retouchedFileSize: null,
    retouchedAt: null,
  })

describe('SetPhotoRetouchFlagHandler', () => {
  let handler: SetPhotoRetouchFlagHandler
  let photoRead: any
  let photoWrite: any
  let authz: any
  const scope = EventScope.unrestricted()

  beforeEach(() => {
    photoRead = { findById: jest.fn(), findByIdInScope: jest.fn() }
    photoWrite = { setRequiresRetouch: jest.fn().mockResolvedValue(undefined) }
    authz = {
      resolveEventScope: jest.fn().mockResolvedValue(scope),
      assert: jest.fn().mockResolvedValue(undefined),
    }
    handler = new SetPhotoRetouchFlagHandler(photoRead, photoWrite, authz)
  })

  it('throws NOT_FOUND when photo missing (including out-of-scope)', async () => {
    photoRead.findByIdInScope.mockResolvedValue(null)

    await expect(
      handler.execute(new SetPhotoRetouchFlagCommand('p-x', true, 'u1')),
    ).rejects.toBeInstanceOf(AppException)
    expect(authz.assert).not.toHaveBeenCalled()
    expect(photoWrite.setRequiresRetouch).not.toHaveBeenCalled()
  })

  it('rejects when the caller lacks photo.retouch.flag for this event', async () => {
    photoRead.findByIdInScope.mockResolvedValue(buildPhoto())
    authz.assert.mockRejectedValueOnce(new Error('Insufficient permissions'))

    await expect(
      handler.execute(new SetPhotoRetouchFlagCommand('p-1', true, 'u1')),
    ).rejects.toThrow('Insufficient permissions')
    expect(photoWrite.setRequiresRetouch).not.toHaveBeenCalled()
  })

  it('sets the flag after resolving scope and asserting', async () => {
    photoRead.findByIdInScope.mockResolvedValue(buildPhoto())

    await handler.execute(new SetPhotoRetouchFlagCommand('p-1', false, 'u1'))

    expect(authz.resolveEventScope).toHaveBeenCalledWith('u1')
    expect(photoRead.findByIdInScope).toHaveBeenCalledWith('p-1', scope)
    expect(authz.assert).toHaveBeenCalledWith('u1', 'photo.retouch.flag', 'e-1')
    expect(photoWrite.setRequiresRetouch).toHaveBeenCalledWith('p-1', false)
  })
})
