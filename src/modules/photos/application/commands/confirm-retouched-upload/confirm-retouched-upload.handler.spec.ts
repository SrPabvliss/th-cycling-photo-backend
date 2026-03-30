import { Photo } from '@photos/domain/entities'
import type { IPhotoReadRepository, IPhotoWriteRepository } from '@photos/domain/ports'
import { AppException } from '@shared/domain'
import type { IStorageAdapter } from '@shared/storage/domain/ports/storage-adapter.port'
import { ConfirmRetouchedUploadCommand } from './confirm-retouched-upload.command'
import { ConfirmRetouchedUploadHandler } from './confirm-retouched-upload.handler'

describe('ConfirmRetouchedUploadHandler', () => {
  let handler: ConfirmRetouchedUploadHandler
  let photoReadRepo: jest.Mocked<IPhotoReadRepository>
  let photoWriteRepo: jest.Mocked<IPhotoWriteRepository>
  let storageAdapter: jest.Mocked<IStorageAdapter>

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
      status: 'completed',
      unclassifiedReason: null,
      capturedAt: null,
      uploadedAt: new Date(),
      processedAt: new Date(),
      retouchedStorageKey: retouchedKey,
      retouchedFileSize: retouchedKey ? 3000n : null,
      retouchedAt: retouchedKey ? new Date() : null,
    })

  beforeEach(() => {
    photoReadRepo = {
      findById: jest.fn(),
      existsByEventAndFilename: jest.fn(),
      getPhotosList: jest.fn(),
      getPhotoDetail: jest.fn(),
      searchPhotos: jest.fn(),
      findFirstStorageKeyByEvent: jest.fn(),
      findFirstStorageKeysByEventIds: jest.fn(),
      getTotalFileSizeByEvent: jest.fn(),
      getTotalFileSizesByEventIds: jest.fn(),
      getClassifiedCountByEvent: jest.fn(),
      getClassifiedCountsByEventIds: jest.fn(),
      getAllPhotoKeysForEvent: jest.fn(),
      getResumePoint: jest.fn(),
      countAll: jest.fn(),
      sumAllFileSize: jest.fn(),
      countByIds: jest.fn(),
      findSimilar: jest.fn(),
    } as jest.Mocked<IPhotoReadRepository>

    photoWriteRepo = {
      save: jest.fn(),
      saveMany: jest.fn(),
      delete: jest.fn(),
      markAsClassified: jest.fn(),
      bulkUpdateCategory: jest.fn(),
    } as jest.Mocked<IPhotoWriteRepository>

    storageAdapter = {
      upload: jest.fn(),
      getPresignedUrl: jest.fn(),
      getPresignedDownloadUrl: jest.fn(),
      getPublicUrl: jest.fn(),
      delete: jest.fn(),
    } as jest.Mocked<IStorageAdapter>

    handler = new ConfirmRetouchedUploadHandler(photoReadRepo, photoWriteRepo, storageAdapter)
  })

  it('should throw NOT_FOUND when photo does not exist', async () => {
    photoReadRepo.findById.mockResolvedValueOnce(null)

    const command = new ConfirmRetouchedUploadCommand(
      'non-existent',
      `events/${eventId}/retouched/uuid-file.jpg`,
      5000,
    )

    const error = await handler.execute(command).catch((e) => e)
    expect(error).toBeInstanceOf(AppException)
    expect(error.code).toBe('NOT_FOUND')
  })

  it('should throw BUSINESS_RULE when object key prefix is invalid', async () => {
    photoReadRepo.findById.mockResolvedValueOnce(createPhoto())

    const command = new ConfirmRetouchedUploadCommand(
      'photo-001',
      'events/wrong-event/retouched/uuid-file.jpg',
      5000,
    )

    const error = await handler.execute(command).catch((e) => e)
    expect(error).toBeInstanceOf(AppException)
    expect(error.code).toBe('BUSINESS_RULE')
  })

  it('should confirm first retouched upload without deleting old file', async () => {
    const photo = createPhoto()
    photoReadRepo.findById.mockResolvedValueOnce(photo)
    photoWriteRepo.save.mockResolvedValueOnce(photo)

    const objectKey = `events/${eventId}/retouched/uuid-retouched.jpg`
    const command = new ConfirmRetouchedUploadCommand('photo-001', objectKey, 5000)

    const result = await handler.execute(command)

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
    photoReadRepo.findById.mockResolvedValueOnce(photo)
    photoWriteRepo.save.mockResolvedValueOnce(photo)

    const newKey = `events/${eventId}/retouched/new-uuid-retouched.jpg`
    const command = new ConfirmRetouchedUploadCommand('photo-001', newKey, 6000)

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
    photoReadRepo.findById.mockResolvedValueOnce(photo)
    photoWriteRepo.save.mockResolvedValueOnce(photo)
    storageAdapter.delete.mockRejectedValueOnce(new Error('S3 delete failed'))

    const newKey = `events/${eventId}/retouched/new-uuid.jpg`
    const command = new ConfirmRetouchedUploadCommand('photo-001', newKey, 4000)

    const result = await handler.execute(command)

    expect(result).toEqual({ confirmed: true })
    expect(storageAdapter.delete).toHaveBeenCalledWith(oldKey)
    expect(photoWriteRepo.save).toHaveBeenCalled()
  })
})
