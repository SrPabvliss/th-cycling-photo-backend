import { Photo } from '@photos/domain/entities'
import type { IPhotoReadRepository } from '@photos/domain/ports'
import { AppException } from '@shared/domain'
import type { IStorageAdapter } from '@shared/storage/domain/ports/storage-adapter.port'
import { GenerateRetouchedPresignedUrlCommand } from './generate-retouched-presigned-url.command'
import { GenerateRetouchedPresignedUrlHandler } from './generate-retouched-presigned-url.handler'

describe('GenerateRetouchedPresignedUrlHandler', () => {
  let handler: GenerateRetouchedPresignedUrlHandler
  let photoReadRepo: jest.Mocked<IPhotoReadRepository>
  let storageAdapter: jest.Mocked<IStorageAdapter>

  const existingPhoto = Photo.create({
    eventId: '550e8400-e29b-41d4-a716-446655440000',
    filename: 'photo-001.jpg',
    storageKey: 'events/550e8400-e29b-41d4-a716-446655440000/photos/abc-photo-001.jpg',
    fileSize: 2048n,
    mimeType: 'image/jpeg',
  })

  beforeEach(() => {
    photoReadRepo = {
      findById: jest.fn(),
      existsByEventAndFilename: jest.fn(),
      getPhotosList: jest.fn(),
      getPhotoDetail: jest.fn(),
      getPhotoViewBySlug: jest.fn(),
      searchPhotos: jest.fn(),
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

    handler = new GenerateRetouchedPresignedUrlHandler(photoReadRepo, storageAdapter)
  })

  it('should throw NOT_FOUND when photo does not exist', async () => {
    photoReadRepo.findById.mockResolvedValueOnce(null)

    const command = new GenerateRetouchedPresignedUrlCommand(
      'non-existent-id',
      'retouched.jpg',
      'image/jpeg',
    )

    const error = await handler.execute(command).catch((e) => e)
    expect(error).toBeInstanceOf(AppException)
    expect(error.code).toBe('NOT_FOUND')
  })

  it('should generate presigned URL with retouched path prefix', async () => {
    photoReadRepo.findById.mockResolvedValueOnce(existingPhoto)
    storageAdapter.getPresignedUrl.mockResolvedValueOnce({
      url: 'https://s3.us-east-005.backblazeb2.com/signed-url',
      objectKey: 'events/550e8400/retouched/uuid-retouched.jpg',
      expiresIn: 300,
    })

    const command = new GenerateRetouchedPresignedUrlCommand(
      existingPhoto.id,
      'retouched.jpg',
      'image/jpeg',
    )

    const result = await handler.execute(command)

    expect(result.isDuplicate).toBe(false)
    expect(result.url).toBe('https://s3.us-east-005.backblazeb2.com/signed-url')
    expect(result.expiresIn).toBe(300)

    const calledKey = storageAdapter.getPresignedUrl.mock.calls[0][0].key
    expect(calledKey).toMatch(
      /^events\/550e8400-e29b-41d4-a716-446655440000\/retouched\/[a-f0-9-]+-retouched\.jpg$/,
    )
  })

  it('should sanitize file name in object key', async () => {
    photoReadRepo.findById.mockResolvedValueOnce(existingPhoto)
    storageAdapter.getPresignedUrl.mockResolvedValueOnce({
      url: 'https://signed-url',
      objectKey: 'key',
      expiresIn: 300,
    })

    const command = new GenerateRetouchedPresignedUrlCommand(
      existingPhoto.id,
      'file with spaces!@#.jpg',
      'image/jpeg',
    )

    await handler.execute(command)

    const calledKey = storageAdapter.getPresignedUrl.mock.calls[0][0].key
    expect(calledKey).toContain('file_with_spaces___.jpg')
  })
})
