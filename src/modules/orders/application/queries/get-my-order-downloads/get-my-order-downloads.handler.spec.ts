import type { IOrderReadRepository } from '@orders/domain/ports'
import type { IStorageAdapter } from '@shared/storage/domain/ports'
import { GetMyOrderDownloadsHandler } from './get-my-order-downloads.handler'
import { GetMyOrderDownloadsQuery } from './get-my-order-downloads.query'

describe('GetMyOrderDownloadsHandler', () => {
  const USER_ID = 'user-1'
  const ORDER_ID = 'order-1'

  let handler: GetMyOrderDownloadsHandler
  let readRepo: jest.Mocked<IOrderReadRepository>
  let storage: jest.Mocked<IStorageAdapter>

  beforeEach(() => {
    readRepo = {
      getMyDownloadFiles: jest.fn(),
      getMyDetail: jest.fn(),
    } as unknown as jest.Mocked<IOrderReadRepository>

    storage = {
      getPresignedDownloadUrl: jest.fn(async ({ filename }) => `https://b2.test/${filename}`),
    } as unknown as jest.Mocked<IStorageAdapter>

    handler = new GetMyOrderDownloadsHandler(readRepo, storage)
  })

  it('mints a presigned URL per photo with a generic filename', async () => {
    readRepo.getMyDownloadFiles.mockResolvedValue([
      { id: 'photo-a', storageKey: 'key-a', fileSize: 10 },
      { id: 'photo-b', storageKey: 'key-b', fileSize: 20 },
    ])

    const result = await handler.execute(new GetMyOrderDownloadsQuery(USER_ID, ORDER_ID))

    expect(result.photos).toEqual([
      {
        id: 'photo-a',
        filename: 'photo-1.jpg',
        fileSize: 10,
        downloadUrl: 'https://b2.test/photo-1.jpg',
      },
      {
        id: 'photo-b',
        filename: 'photo-2.jpg',
        fileSize: 20,
        downloadUrl: 'https://b2.test/photo-2.jpg',
      },
    ])
  })

  it('rejects with not_downloadable when the order exists but is not ready', async () => {
    readRepo.getMyDownloadFiles.mockResolvedValue(null)
    readRepo.getMyDetail.mockResolvedValue({ id: ORDER_ID } as never)

    await expect(handler.execute(new GetMyOrderDownloadsQuery(USER_ID, ORDER_ID))).rejects.toThrow(
      /order\.not_downloadable/,
    )
  })

  it('rejects with a not-found when the order is not the callers', async () => {
    readRepo.getMyDownloadFiles.mockResolvedValue(null)
    readRepo.getMyDetail.mockResolvedValue(null)

    await expect(
      handler.execute(new GetMyOrderDownloadsQuery(USER_ID, ORDER_ID)),
    ).rejects.toMatchObject({
      messageKey: 'errors.NOT_FOUND',
      context: { entity: 'entities.order' },
    })
  })
})
