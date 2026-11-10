import { Test } from '@nestjs/testing'
import {
  type IStorageAdapter,
  STORAGE_ADAPTER,
} from '@shared/storage/domain/ports/storage-adapter.port'
import {
  CROP_UPLOAD_MAX_PER_TYPE,
  CROP_UPLOAD_TTL_SECONDS,
} from '../../domain/ports/crop-upload-urls.port'
import { CropUploadUrlsService } from './crop-upload-urls.service'

describe('CropUploadUrlsService', () => {
  let service: CropUploadUrlsService
  let storage: jest.Mocked<IStorageAdapter>

  beforeEach(async () => {
    storage = {
      upload: jest.fn(),
      download: jest.fn(),
      getPresignedUrl: jest.fn(async ({ key }) => ({
        url: `https://b2.example.com/${key}?sig=mock`,
        objectKey: key,
        expiresIn: CROP_UPLOAD_TTL_SECONDS,
      })),
      getPresignedDownloadUrl: jest.fn(),
      getPublicUrl: jest.fn(),
      delete: jest.fn(),
    }

    const moduleRef = await Test.createTestingModule({
      providers: [CropUploadUrlsService, { provide: STORAGE_ADAPTER, useValue: storage }],
    }).compile()

    service = moduleRef.get(CropUploadUrlsService)
  })

  it('signs only MAX_PER_TYPE bib URLs and returns empty color lists', async () => {
    const result = await service.generate('photo-1', 'event-1')

    expect(result.bibs).toHaveLength(CROP_UPLOAD_MAX_PER_TYPE)
    expect(result.colorsHelmet).toEqual([])
    expect(result.colorsClothes).toEqual([])
    expect(result.colorsBicycle).toEqual([])
    expect(storage.getPresignedUrl).toHaveBeenCalledTimes(CROP_UPLOAD_MAX_PER_TYPE)
  })

  it('uses canonical paths events/{eventId}/photos/{photoId}/crops/bibs/{idx}.jpg', async () => {
    await service.generate('photo-1', 'event-1')
    const calls = storage.getPresignedUrl.mock.calls.map((c) => c[0].key)
    expect(calls).toContain('events/event-1/photos/photo-1/crops/bibs/0.jpg')
    expect(calls).toContain('events/event-1/photos/photo-1/crops/bibs/9.jpg')
    expect(calls.every((key) => key.includes('/crops/bibs/'))).toBe(true)
  })

  it('requests image/jpeg content-type and TTL of 600s for every bib URL', async () => {
    await service.generate('photo-1', 'event-1')
    for (const call of storage.getPresignedUrl.mock.calls) {
      expect(call[0].contentType).toBe('image/jpeg')
      expect(call[0].expiresIn).toBe(CROP_UPLOAD_TTL_SECONDS)
    }
  })
})
