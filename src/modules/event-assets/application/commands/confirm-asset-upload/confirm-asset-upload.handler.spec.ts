import type { IEventReadRepository } from '@events/domain/ports'
import type { IKvStorageAdapter } from '@shared/cloudflare/domain/ports'
import type { IStorageAdapter } from '@shared/storage/domain/ports'
import type { IEventAssetReadRepository, IEventAssetWriteRepository } from '../../../domain/ports'
import { ConfirmAssetUploadCommand } from './confirm-asset-upload.command'
import { ConfirmAssetUploadHandler } from './confirm-asset-upload.handler'

describe('ConfirmAssetUploadHandler', () => {
  let handler: ConfirmAssetUploadHandler
  let eventReadRepo: jest.Mocked<IEventReadRepository>
  let readRepo: jest.Mocked<IEventAssetReadRepository>
  let writeRepo: jest.Mocked<IEventAssetWriteRepository>
  let storage: jest.Mocked<IStorageAdapter>
  let kvStorage: jest.Mocked<IKvStorageAdapter>

  beforeEach(() => {
    eventReadRepo = {
      findById: jest.fn(),
    } as unknown as jest.Mocked<IEventReadRepository>

    readRepo = {
      findByEventAndType: jest.fn(),
    } as unknown as jest.Mocked<IEventAssetReadRepository>

    writeRepo = {
      save: jest.fn(),
    } as unknown as jest.Mocked<IEventAssetWriteRepository>

    storage = {
      delete: jest.fn(),
    } as unknown as jest.Mocked<IStorageAdapter>

    kvStorage = {
      write: jest.fn(),
      delete: jest.fn(),
    } as unknown as jest.Mocked<IKvStorageAdapter>

    handler = new ConfirmAssetUploadHandler(eventReadRepo, readRepo, writeRepo, storage, kvStorage)
  })

  it('rejects asset types other than cover_image', async () => {
    const command = new ConfirmAssetUploadCommand(
      'event-uuid',
      // biome-ignore lint/suspicious/noExplicitAny: Force-cast forbidden enum to test runtime guard
      'poster' as any,
      'events/event-uuid/assets/poster/foo.jpg',
      null,
      null,
    )

    await expect(handler.execute(command)).rejects.toThrow(/event_asset\.unsupported_type/)
    expect(eventReadRepo.findById).not.toHaveBeenCalled()
    expect(writeRepo.save).not.toHaveBeenCalled()
  })
})
