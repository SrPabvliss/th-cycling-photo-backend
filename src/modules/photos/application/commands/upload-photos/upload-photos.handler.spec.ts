import { Event } from '@events/domain/entities'
import type { IEventReadRepository } from '@events/domain/ports'
import type { IPhotoWriteRepository } from '@photos/domain/ports'
import { AppException } from '@shared/domain'
import type { IStorageAdapter } from '@shared/storage/domain/ports/storage-adapter.port'
import type { FilePayload } from './upload-photos.command'
import { UploadPhotosCommand } from './upload-photos.command'
import { UploadPhotosHandler } from './upload-photos.handler'

describe('UploadPhotosHandler', () => {
  let handler: UploadPhotosHandler
  let eventReadRepo: jest.Mocked<IEventReadRepository>
  let photoWriteRepo: jest.Mocked<IPhotoWriteRepository>
  let storageAdapter: jest.Mocked<IStorageAdapter>

  const futureDate = new Date()
  futureDate.setFullYear(futureDate.getFullYear() + 1)

  const existingEvent = Event.fromPersistence({
    id: '550e8400-e29b-41d4-a716-446655440000',
    name: 'Test Event',
    date: futureDate,
    location: 'Ambato',
    status: 'draft',
    totalPhotos: 0,
    processedPhotos: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  })

  const mockFile: FilePayload = {
    buffer: Buffer.from('fake-image'),
    originalname: 'photo-001.jpg',
    mimetype: 'image/jpeg',
    size: 1024,
  }

  beforeEach(() => {
    eventReadRepo = {
      findById: jest.fn(),
      getEventsList: jest.fn(),
      getEventDetail: jest.fn(),
    } as jest.Mocked<IEventReadRepository>

    photoWriteRepo = {
      save: jest.fn(),
      delete: jest.fn(),
      saveClassification: jest.fn(),
    } as jest.Mocked<IPhotoWriteRepository>

    storageAdapter = {
      upload: jest.fn(),
      getPublicUrl: jest.fn(),
      delete: jest.fn(),
    } as jest.Mocked<IStorageAdapter>

    handler = new UploadPhotosHandler(eventReadRepo, photoWriteRepo, storageAdapter)
  })

  it('should upload files and return entity IDs', async () => {
    eventReadRepo.findById.mockResolvedValue(existingEvent)
    storageAdapter.upload.mockResolvedValue({ key: 'key', url: 'http://url' })
    photoWriteRepo.save.mockImplementation(async (photo) => photo)

    const command = new UploadPhotosCommand(existingEvent.id, [mockFile])
    const result = await handler.execute(command)

    expect(result).toHaveLength(1)
    expect(result[0]).toHaveProperty('id')
    expect(typeof result[0].id).toBe('string')
    expect(eventReadRepo.findById).toHaveBeenCalledWith(existingEvent.id)
    expect(storageAdapter.upload).toHaveBeenCalledTimes(1)
    expect(photoWriteRepo.save).toHaveBeenCalledTimes(1)
    expect(photoWriteRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        eventId: existingEvent.id,
        filename: 'photo-001.jpg',
        mimeType: 'image/jpeg',
        status: 'pending',
      }),
    )
  })

  it('should upload multiple files sequentially', async () => {
    eventReadRepo.findById.mockResolvedValue(existingEvent)
    storageAdapter.upload.mockResolvedValue({ key: 'key', url: 'http://url' })
    photoWriteRepo.save.mockImplementation(async (photo) => photo)

    const files: FilePayload[] = [
      { ...mockFile, originalname: 'photo-001.jpg' },
      { ...mockFile, originalname: 'photo-002.png', mimetype: 'image/png' },
    ]

    const command = new UploadPhotosCommand(existingEvent.id, files)
    const result = await handler.execute(command)

    expect(result).toHaveLength(2)
    expect(storageAdapter.upload).toHaveBeenCalledTimes(2)
    expect(photoWriteRepo.save).toHaveBeenCalledTimes(2)
  })

  it('should throw 404 when event does not exist', async () => {
    eventReadRepo.findById.mockResolvedValue(null)

    const command = new UploadPhotosCommand('non-existent-id', [mockFile])

    await expect(handler.execute(command)).rejects.toThrow(AppException)
    expect(storageAdapter.upload).not.toHaveBeenCalled()
    expect(photoWriteRepo.save).not.toHaveBeenCalled()
  })

  it('should build storage key with correct extension', async () => {
    eventReadRepo.findById.mockResolvedValue(existingEvent)
    storageAdapter.upload.mockResolvedValue({ key: 'key', url: 'http://url' })
    photoWriteRepo.save.mockImplementation(async (photo) => photo)

    const pngFile: FilePayload = { ...mockFile, originalname: 'test.png', mimetype: 'image/png' }
    const command = new UploadPhotosCommand(existingEvent.id, [pngFile])
    await handler.execute(command)

    expect(storageAdapter.upload).toHaveBeenCalledWith(
      expect.objectContaining({
        key: expect.stringMatching(/^events\/.*\/photos\/.*\.png$/),
        contentType: 'image/png',
      }),
    )
  })
})
