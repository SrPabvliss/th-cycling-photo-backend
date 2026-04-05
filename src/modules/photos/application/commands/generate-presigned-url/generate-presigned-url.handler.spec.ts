import { Event } from '@events/domain/entities'
import type { IEventReadRepository } from '@events/domain/ports'
import type { IPhotoReadRepository } from '@photos/domain/ports'
import { AppException } from '@shared/domain'
import type { IStorageAdapter } from '@shared/storage/domain/ports/storage-adapter.port'
import { GeneratePresignedUrlCommand } from './generate-presigned-url.command'
import { GeneratePresignedUrlHandler } from './generate-presigned-url.handler'

describe('GeneratePresignedUrlHandler', () => {
  let handler: GeneratePresignedUrlHandler
  let eventReadRepo: jest.Mocked<IEventReadRepository>
  let photoReadRepo: jest.Mocked<IPhotoReadRepository>
  let storageAdapter: jest.Mocked<IStorageAdapter>

  const futureDate = new Date()
  futureDate.setFullYear(futureDate.getFullYear() + 1)

  const existingEvent = Event.fromPersistence({
    id: '550e8400-e29b-41d4-a716-446655440000',
    name: 'Test Event',
    description: null,
    date: futureDate,
    location: 'Ambato',
    provinceId: null,
    cantonId: null,
    eventTypeId: 1,
    status: 'active',
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  })

  beforeEach(() => {
    eventReadRepo = {
      findById: jest.fn(),
      getEventsList: jest.fn(),
      getEventDetail: jest.fn(),
      countAll: jest.fn(),
      getPublicEventsList: jest.fn(),
      getPublicEventDetail: jest.fn(),
      getPublicPhotos: jest.fn(),
      existsActiveEvent: jest.fn(),
    } as jest.Mocked<IEventReadRepository>

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
      countByIdsAndEvent: jest.fn(),
    } as jest.Mocked<IPhotoReadRepository>

    storageAdapter = {
      upload: jest.fn(),
      getPresignedUrl: jest.fn(),
      getPresignedDownloadUrl: jest.fn(),
      getPublicUrl: jest.fn(),
      delete: jest.fn(),
    } as jest.Mocked<IStorageAdapter>

    handler = new GeneratePresignedUrlHandler(eventReadRepo, photoReadRepo, storageAdapter)
  })

  it('should throw NOT_FOUND when event does not exist', async () => {
    eventReadRepo.findById.mockResolvedValueOnce(null)

    const command = new GeneratePresignedUrlCommand('non-existent-id', 'photo.jpg', 'image/jpeg')

    const error = await handler.execute(command).catch((e) => e)
    expect(error).toBeInstanceOf(AppException)
    expect(error.code).toBe('NOT_FOUND')
  })

  it('should return isDuplicate: true when photo already exists for event', async () => {
    eventReadRepo.findById.mockResolvedValueOnce(existingEvent)
    photoReadRepo.existsByEventAndFilename.mockResolvedValueOnce(true)

    const command = new GeneratePresignedUrlCommand(
      existingEvent.id,
      'already-uploaded.jpg',
      'image/jpeg',
    )

    const result = await handler.execute(command)

    expect(result).toEqual({
      isDuplicate: true,
      url: null,
      objectKey: null,
      expiresIn: null,
    })
    expect(storageAdapter.getPresignedUrl).not.toHaveBeenCalled()
    expect(photoReadRepo.existsByEventAndFilename).toHaveBeenCalledWith(
      existingEvent.id,
      'already-uploaded.jpg',
    )
  })

  it('should generate presigned URL with sanitized file name in object key', async () => {
    eventReadRepo.findById.mockResolvedValueOnce(existingEvent)
    photoReadRepo.existsByEventAndFilename.mockResolvedValueOnce(false)
    storageAdapter.getPresignedUrl.mockResolvedValueOnce({
      url: 'https://s3.us-east-005.backblazeb2.com/signed-url',
      objectKey: 'events/550e8400/uuid-photo_with_spaces.jpg',
      expiresIn: 300,
    })

    const command = new GeneratePresignedUrlCommand(
      existingEvent.id,
      'photo with spaces!@#.jpg',
      'image/jpeg',
    )

    await handler.execute(command)

    expect(storageAdapter.getPresignedUrl).toHaveBeenCalledWith(
      expect.objectContaining({
        key: expect.stringMatching(
          /^events\/550e8400-e29b-41d4-a716-446655440000\/photos\/[a-f0-9-]+-photo_with_spaces___.jpg$/,
        ),
        contentType: 'image/jpeg',
        expiresIn: 300,
      }),
    )
  })

  it('should return isDuplicate: false with presigned URL for new photos', async () => {
    eventReadRepo.findById.mockResolvedValueOnce(existingEvent)
    photoReadRepo.existsByEventAndFilename.mockResolvedValueOnce(false)
    storageAdapter.getPresignedUrl.mockResolvedValueOnce({
      url: 'https://s3.us-east-005.backblazeb2.com/signed-url',
      objectKey: 'events/550e8400/uuid-photo.jpg',
      expiresIn: 300,
    })

    const command = new GeneratePresignedUrlCommand(existingEvent.id, 'photo.jpg', 'image/jpeg')

    const result = await handler.execute(command)
    expect(result).toEqual({
      isDuplicate: false,
      url: 'https://s3.us-east-005.backblazeb2.com/signed-url',
      objectKey: 'events/550e8400/uuid-photo.jpg',
      expiresIn: 300,
    })
  })

  it('should build object key with event ID and UUID prefix under photos/', async () => {
    eventReadRepo.findById.mockResolvedValueOnce(existingEvent)
    photoReadRepo.existsByEventAndFilename.mockResolvedValueOnce(false)
    storageAdapter.getPresignedUrl.mockResolvedValueOnce({
      url: 'https://signed-url',
      objectKey: 'key',
      expiresIn: 300,
    })

    const command = new GeneratePresignedUrlCommand(existingEvent.id, 'clean-file.png', 'image/png')

    await handler.execute(command)

    const calledKey = storageAdapter.getPresignedUrl.mock.calls[0][0].key
    expect(calledKey).toMatch(/^events\/550e8400-e29b-41d4-a716-446655440000\/photos\//)
    expect(calledKey).toContain('clean-file.png')
  })
})
