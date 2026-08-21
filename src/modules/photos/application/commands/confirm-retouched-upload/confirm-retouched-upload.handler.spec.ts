import type { FreezeStateService } from '@events/application/services/freeze-state.service'
import type { IOrderReadRepository } from '@orders/domain/ports'
import { Photo } from '@photos/domain/entities'
import type { IPhotoReadRepository, IPhotoWriteRepository } from '@photos/domain/ports'
import { EventScope } from '@shared/authorization/domain/event-scope.vo'
import type { IAuthorizationService } from '@shared/authorization/domain/ports/authorization.service.port'
import type { IKvStorageAdapter } from '@shared/cloudflare/domain/ports'
import { AppException } from '@shared/domain'
import type { IStorageAdapter } from '@shared/storage/domain/ports/storage-adapter.port'
import { ConfirmRetouchedUploadCommand } from './confirm-retouched-upload.command'
import { ConfirmRetouchedUploadHandler } from './confirm-retouched-upload.handler'

describe('ConfirmRetouchedUploadHandler', () => {
  let handler: ConfirmRetouchedUploadHandler
  let photoReadRepo: jest.Mocked<IPhotoReadRepository>
  let photoWriteRepo: jest.Mocked<IPhotoWriteRepository>
  let storageAdapter: jest.Mocked<IStorageAdapter>
  let orderReadRepo: jest.Mocked<Pick<IOrderReadRepository, 'findOrdersFullyRetouchedByPhoto'>>
  let kvStorage: jest.Mocked<IKvStorageAdapter>
  let eventEmitter: { emit: jest.Mock }
  let authz: jest.Mocked<IAuthorizationService>
  const scope = EventScope.unrestricted()

  const eventId = '550e8400-e29b-41d4-a716-446655440000'

  const createPhoto = (retouchedKey: string | null = null) =>
    Photo.fromPersistence({
      id: 'photo-001',
      eventId,
      filename: 'original.jpg',
      storageKey: `events/${eventId}/photos/abc-original.jpg`,
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
      retouchedStorageKey: retouchedKey,
      retouchedPublicSlug: 'retouched-slug',
      retouchedFileSize: retouchedKey ? 3000n : null,
      retouchedAt: retouchedKey ? new Date() : null,
    })

  beforeEach(() => {
    photoReadRepo = {
      findById: jest.fn(),
      findByIdInScope: jest.fn(),
      existsByEventAndFilename: jest.fn(),
      getPhotosList: jest.fn(),
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
      sumAllFileSize: jest.fn(),
      countByIds: jest.fn(),
      findSimilar: jest.fn(),
      countByIdsAndEvent: jest.fn(),
      getReviewQueue: jest.fn(),
      getReviewQueueByEventIds: jest.fn(),
    } as jest.Mocked<IPhotoReadRepository>

    photoWriteRepo = {
      save: jest.fn(),
      saveMany: jest.fn(),
      claimPhotoQuota: jest.fn(),
      delete: jest.fn(),
      bulkUpdateCategory: jest.fn(),
      setRequiresRetouch: jest.fn().mockResolvedValue(undefined),
    } as jest.Mocked<IPhotoWriteRepository>

    storageAdapter = {
      upload: jest.fn(),
      getPresignedUrl: jest.fn(),
      getPresignedDownloadUrl: jest.fn(),
      getPublicUrl: jest.fn(),
      delete: jest.fn(),
    } as jest.Mocked<IStorageAdapter>

    orderReadRepo = {
      findOrdersFullyRetouchedByPhoto: jest.fn().mockResolvedValue([]),
    } as jest.Mocked<Pick<IOrderReadRepository, 'findOrdersFullyRetouchedByPhoto'>>

    kvStorage = {
      write: jest.fn().mockResolvedValue(undefined),
      writeBulk: jest.fn(),
      delete: jest.fn().mockResolvedValue(undefined),
    } as jest.Mocked<IKvStorageAdapter>
    eventEmitter = { emit: jest.fn() }

    authz = {
      can: jest.fn(),
      assert: jest.fn().mockResolvedValue(undefined),
      resolveEventScope: jest.fn().mockResolvedValue(scope),
    } as jest.Mocked<IAuthorizationService>

    const freeze = {
      assertNotFrozen: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<FreezeStateService>

    handler = new ConfirmRetouchedUploadHandler(
      photoReadRepo,
      photoWriteRepo,
      storageAdapter,
      kvStorage,
      orderReadRepo as unknown as jest.Mocked<IOrderReadRepository>,
      eventEmitter as any,
      authz,
      freeze,
    )
  })

  it('should throw NOT_FOUND when photo does not exist (including out-of-scope)', async () => {
    photoReadRepo.findByIdInScope.mockResolvedValueOnce(null)

    const command = new ConfirmRetouchedUploadCommand(
      'non-existent',
      `events/${eventId}/retouched/uuid-file.jpg`,
      5000,
      'operator-001',
    )

    const error = await handler.execute(command).catch((e) => e)
    expect(error).toBeInstanceOf(AppException)
    expect(error.code).toBe('NOT_FOUND')
    expect(authz.assert).not.toHaveBeenCalled()
  })

  it('rejects when the caller lacks photo.retouch.upload for this event', async () => {
    photoReadRepo.findByIdInScope.mockResolvedValueOnce(createPhoto())
    authz.assert.mockRejectedValueOnce(new Error('Insufficient permissions'))

    const command = new ConfirmRetouchedUploadCommand(
      'photo-001',
      `events/${eventId}/retouched/uuid-file.jpg`,
      5000,
      'operator-001',
    )

    await expect(handler.execute(command)).rejects.toThrow('Insufficient permissions')
    expect(photoWriteRepo.save).not.toHaveBeenCalled()
  })

  it('should throw BUSINESS_RULE when object key prefix is invalid', async () => {
    photoReadRepo.findByIdInScope.mockResolvedValueOnce(createPhoto())

    const command = new ConfirmRetouchedUploadCommand(
      'photo-001',
      'events/wrong-event/retouched/uuid-file.jpg',
      5000,
      'operator-001',
    )

    const error = await handler.execute(command).catch((e) => e)
    expect(error).toBeInstanceOf(AppException)
    expect(error.code).toBe('BUSINESS_RULE')
  })

  it('should confirm first retouched upload without deleting old file', async () => {
    const photo = createPhoto()
    photoReadRepo.findByIdInScope.mockResolvedValueOnce(photo)
    photoWriteRepo.save.mockResolvedValueOnce(photo)

    const objectKey = `events/${eventId}/retouched/uuid-retouched.jpg`
    const command = new ConfirmRetouchedUploadCommand('photo-001', objectKey, 5000, 'operator-001')

    const result = await handler.execute(command)

    expect(authz.assert).toHaveBeenCalledWith('operator-001', 'photo.retouch.upload', eventId)
    expect(result).toEqual({ confirmed: true })
    expect(storageAdapter.delete).not.toHaveBeenCalled()
    expect(photoWriteRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        retouchedStorageKey: objectKey,
        retouchedFileSize: 5000n,
      }),
    )
  })

  it('should delete old retouched file when replacing', async () => {
    const oldKey = `events/${eventId}/retouched/old-uuid-retouched.jpg`
    const photo = createPhoto(oldKey)
    photoReadRepo.findByIdInScope.mockResolvedValueOnce(photo)
    photoWriteRepo.save.mockResolvedValueOnce(photo)

    const newKey = `events/${eventId}/retouched/new-uuid-retouched.jpg`
    const command = new ConfirmRetouchedUploadCommand('photo-001', newKey, 6000, 'operator-001')

    const result = await handler.execute(command)

    expect(result).toEqual({ confirmed: true })
    expect(storageAdapter.delete).toHaveBeenCalledWith(oldKey)
    expect(photoWriteRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        retouchedStorageKey: newKey,
        retouchedFileSize: 6000n,
      }),
    )
  })

  it('should still confirm even if old file deletion fails', async () => {
    const oldKey = `events/${eventId}/retouched/old-uuid.jpg`
    const photo = createPhoto(oldKey)
    photoReadRepo.findByIdInScope.mockResolvedValueOnce(photo)
    photoWriteRepo.save.mockResolvedValueOnce(photo)
    storageAdapter.delete.mockRejectedValueOnce(new Error('S3 delete failed'))

    const newKey = `events/${eventId}/retouched/new-uuid.jpg`
    const command = new ConfirmRetouchedUploadCommand('photo-001', newKey, 4000, 'operator-001')

    const result = await handler.execute(command)

    expect(result).toEqual({ confirmed: true })
    expect(storageAdapter.delete).toHaveBeenCalledWith(oldKey)
    expect(photoWriteRepo.save).toHaveBeenCalled()
  })
})
