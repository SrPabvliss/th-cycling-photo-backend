import type { IOrderReadRepository } from '@orders/domain/ports'
import type { CdnUrlBuilder } from '@shared/cloudflare/infrastructure'
import type { IStorageAdapter } from '@shared/storage/domain/ports'
import { GetMyOrderDownloadsHandler } from './get-my-order-downloads.handler'
import { GetMyOrderDownloadsQuery } from './get-my-order-downloads.query'

describe('GetMyOrderDownloadsHandler', () => {
  const USER_ID = 'user-1'
  const ORDER_ID = 'order-1'

  let handler: GetMyOrderDownloadsHandler
  let readRepo: jest.Mocked<IOrderReadRepository>
  let storage: jest.Mocked<IStorageAdapter>
  let cdn: { internalUrl: jest.Mock }

  beforeEach(() => {
    readRepo = {
      getMyDownloadFiles: jest.fn(),
      getMyDetail: jest.fn(),
    } as unknown as jest.Mocked<IOrderReadRepository>

    storage = {
      getPresignedDownloadUrl: jest.fn(async ({ filename }) => `https://b2.test/${filename}`),
    } as unknown as jest.Mocked<IStorageAdapter>

    cdn = {
      internalUrl: jest.fn(
        (slug: string, preset?: string, ttl?: number) =>
          `https://cdn.test/${preset}/${slug}?ttl=${ttl}`,
      ),
    }

    handler = new GetMyOrderDownloadsHandler(readRepo, storage, cdn as unknown as CdnUrlBuilder)
  })

  it('mints a presigned URL per photo with a generic filename', async () => {
    readRepo.getMyDownloadFiles.mockResolvedValue([
      { id: 'photo-a', storageKey: 'key-a', fileSize: 10, publicSlug: 'slug-a' },
      { id: 'photo-b', storageKey: 'key-b', fileSize: 20, publicSlug: 'slug-b' },
    ])

    const result = await handler.execute(new GetMyOrderDownloadsQuery(USER_ID, ORDER_ID))

    expect(result.photos).toEqual([
      {
        id: 'photo-a',
        filename: 'photo-1.jpg',
        fileSize: 10,
        downloadUrl: 'https://b2.test/photo-1.jpg',
        thumbnailUrl: 'https://cdn.test/thumb/slug-a?ttl=3600',
      },
      {
        id: 'photo-b',
        filename: 'photo-2.jpg',
        fileSize: 20,
        downloadUrl: 'https://b2.test/photo-2.jpg',
        thumbnailUrl: 'https://cdn.test/thumb/slug-b?ttl=3600',
      },
    ])
  })

  it('signs the thumbnail for as long as the download URL lives', async () => {
    readRepo.getMyDownloadFiles.mockResolvedValue([
      { id: 'photo-a', storageKey: 'key-a', fileSize: 10, publicSlug: 'slug-a' },
    ])

    await handler.execute(new GetMyOrderDownloadsQuery(USER_ID, ORDER_ID))

    expect(cdn.internalUrl).toHaveBeenCalledWith('slug-a', 'thumb', 3600)
    expect(storage.getPresignedDownloadUrl).toHaveBeenCalledWith(
      expect.objectContaining({ expiresIn: 3600 }),
    )
  })

  it('answers a null thumbnail for a photo without a slug and still returns the rest', async () => {
    readRepo.getMyDownloadFiles.mockResolvedValue([
      { id: 'photo-a', storageKey: 'key-a', fileSize: 10, publicSlug: null },
      { id: 'photo-b', storageKey: 'key-b', fileSize: 20, publicSlug: 'slug-b' },
    ])

    const result = await handler.execute(new GetMyOrderDownloadsQuery(USER_ID, ORDER_ID))

    expect(result.photos.map((photo) => photo.thumbnailUrl)).toEqual([
      null,
      'https://cdn.test/thumb/slug-b?ttl=3600',
    ])
    expect(result.photos[0].downloadUrl).toBe('https://b2.test/photo-1.jpg')
    expect(cdn.internalUrl).toHaveBeenCalledTimes(1)
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
