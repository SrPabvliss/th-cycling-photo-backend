import { Event } from '@events/domain/entities'
import type { IEventReadRepository } from '@events/domain/ports'
import { AppException } from '@shared/domain'
import type { IStorageAdapter } from '@shared/storage/domain/ports/storage-adapter.port'
import { GeneratePresignedUrlCommand } from './generate-presigned-url.command'
import { GeneratePresignedUrlHandler } from './generate-presigned-url.handler'

describe('GeneratePresignedUrlHandler', () => {
  let handler: GeneratePresignedUrlHandler
  let eventReadRepo: jest.Mocked<IEventReadRepository>
  let storageAdapter: jest.Mocked<IStorageAdapter>

  const futureDate = new Date()
  futureDate.setFullYear(futureDate.getFullYear() + 1)

  const existingEvent = Event.fromPersistence({
    id: '550e8400-e29b-41d4-a716-446655440000',
    name: 'Test Event',
    date: futureDate,
    location: 'Ambato',
    status: 'active',
    totalPhotos: 0,
    processedPhotos: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  })

  beforeEach(() => {
    eventReadRepo = {
      findById: jest.fn(),
      getEventsList: jest.fn(),
      getEventDetail: jest.fn(),
    } as jest.Mocked<IEventReadRepository>

    storageAdapter = {
      upload: jest.fn(),
      getPresignedUrl: jest.fn(),
      getPublicUrl: jest.fn(),
      delete: jest.fn(),
    } as jest.Mocked<IStorageAdapter>

    handler = new GeneratePresignedUrlHandler(eventReadRepo, storageAdapter)
  })

  it('should throw NOT_FOUND when event does not exist', async () => {
    eventReadRepo.findById.mockResolvedValueOnce(null)

    const command = new GeneratePresignedUrlCommand('non-existent-id', 'photo.jpg', 'image/jpeg')

    const error = await handler.execute(command).catch((e) => e)
    expect(error).toBeInstanceOf(AppException)
    expect(error.code).toBe('NOT_FOUND')
  })

  it('should generate presigned URL with sanitized file name in object key', async () => {
    eventReadRepo.findById.mockResolvedValueOnce(existingEvent)
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
          /^events\/550e8400-e29b-41d4-a716-446655440000\/[a-f0-9-]+-photo_with_spaces___.jpg$/,
        ),
        contentType: 'image/jpeg',
        expiresIn: 300,
      }),
    )
  })

  it('should return the presigned URL result from storage adapter', async () => {
    eventReadRepo.findById.mockResolvedValueOnce(existingEvent)
    const expectedResult = {
      url: 'https://s3.us-east-005.backblazeb2.com/signed-url',
      objectKey: 'events/550e8400/uuid-photo.jpg',
      expiresIn: 300,
    }
    storageAdapter.getPresignedUrl.mockResolvedValueOnce(expectedResult)

    const command = new GeneratePresignedUrlCommand(existingEvent.id, 'photo.jpg', 'image/jpeg')

    const result = await handler.execute(command)
    expect(result).toEqual(expectedResult)
  })

  it('should build object key with event ID and UUID prefix', async () => {
    eventReadRepo.findById.mockResolvedValueOnce(existingEvent)
    storageAdapter.getPresignedUrl.mockResolvedValueOnce({
      url: 'https://signed-url',
      objectKey: 'key',
      expiresIn: 300,
    })

    const command = new GeneratePresignedUrlCommand(existingEvent.id, 'clean-file.png', 'image/png')

    await handler.execute(command)

    const calledKey = storageAdapter.getPresignedUrl.mock.calls[0][0].key
    expect(calledKey).toMatch(/^events\/550e8400-e29b-41d4-a716-446655440000\//)
    expect(calledKey).toContain('clean-file.png')
  })
})
