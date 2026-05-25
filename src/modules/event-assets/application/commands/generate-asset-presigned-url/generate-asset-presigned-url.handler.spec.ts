import type { IEventReadRepository } from '@events/domain/ports'
import { AppException } from '@shared/domain'
import type { IStorageAdapter } from '@shared/storage/domain/ports'
import { GenerateAssetPresignedUrlCommand } from './generate-asset-presigned-url.command'
import { GenerateAssetPresignedUrlHandler } from './generate-asset-presigned-url.handler'

describe('GenerateAssetPresignedUrlHandler', () => {
  let handler: GenerateAssetPresignedUrlHandler
  let eventReadRepo: jest.Mocked<IEventReadRepository>
  let storage: jest.Mocked<IStorageAdapter>

  beforeEach(() => {
    eventReadRepo = {
      findById: jest.fn(),
    } as unknown as jest.Mocked<IEventReadRepository>

    storage = {
      getPresignedUrl: jest.fn(),
      delete: jest.fn(),
    } as unknown as jest.Mocked<IStorageAdapter>

    handler = new GenerateAssetPresignedUrlHandler(eventReadRepo, storage)
  })

  it('rejects asset types other than cover_image', async () => {
    const command = new GenerateAssetPresignedUrlCommand(
      'event-uuid',
      // biome-ignore lint/suspicious/noExplicitAny: Force-cast forbidden enum to test runtime guard
      'event_logo' as any,
      'logo.jpg',
      'image/jpeg',
    )

    await expect(handler.execute(command)).rejects.toThrow(/event_asset\.unsupported_type/)
    expect(eventReadRepo.findById).not.toHaveBeenCalled()
    expect(storage.getPresignedUrl).not.toHaveBeenCalled()
  })

  it('throws not_found when event does not exist for cover_image', async () => {
    eventReadRepo.findById.mockResolvedValue(null)
    const command = new GenerateAssetPresignedUrlCommand(
      'event-uuid',
      'cover_image',
      'banner.jpg',
      'image/jpeg',
    )

    await expect(handler.execute(command)).rejects.toThrow(AppException)
  })
})
