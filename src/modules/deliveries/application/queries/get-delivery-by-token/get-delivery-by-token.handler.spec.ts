import type {
  IDeliveryLinkReadRepository,
  IDeliveryLinkWriteRepository,
} from '@deliveries/domain/ports'
import type { CdnUrlBuilder } from '@shared/cloudflare/infrastructure'
import type { IStorageAdapter } from '@shared/storage/domain/ports'
import { GetDeliveryByTokenHandler } from './get-delivery-by-token.handler'
import { GetDeliveryByTokenQuery } from './get-delivery-by-token.query'

describe('GetDeliveryByTokenHandler', () => {
  const TOKEN = 'a'.repeat(64)

  const photo = (id: string, publicSlug: string | null) => ({
    id,
    filename: `IMG_${id}.jpg`,
    storageKey: `events/e1/photos/${id}.jpg`,
    fileSize: 1000,
    publicSlug,
  })

  const setup = (options: { photos?: ReturnType<typeof photo>[]; recorded?: boolean } = {}) => {
    const link = { id: 'link-1', checkExpiration: jest.fn().mockReturnValue(false) }
    const readRepo = {
      findByToken: jest.fn().mockResolvedValue(link),
      getDeliveryData: jest.fn().mockResolvedValue({
        token: TOKEN,
        eventName: 'Vuelta al Cotopaxi',
        status: 'active',
        expiresAt: new Date('2026-12-01T00:00:00Z'),
        downloadCount: 3,
        photos: options.photos ?? [photo('a', 'slug-a'), photo('b', 'slug-b')],
      }),
    }
    const writeRepo = {
      save: jest.fn(),
      tryRecordAccess: jest.fn().mockResolvedValue(options.recorded ?? true),
    }
    const storage = {
      getPresignedDownloadUrl: jest.fn(
        async ({ filename }: { filename: string }) => `https://b2.test/${filename}`,
      ),
    }
    const cdn = {
      internalUrl: jest.fn(
        (slug: string, preset?: string, ttl?: number) =>
          `https://cdn.test/${preset}/${slug}?ttl=${ttl}`,
      ),
    }
    const handler = new GetDeliveryByTokenHandler(
      readRepo as unknown as IDeliveryLinkReadRepository,
      writeRepo as unknown as IDeliveryLinkWriteRepository,
      storage as unknown as IStorageAdapter,
      cdn as unknown as CdnUrlBuilder,
    )
    return { handler, readRepo, writeRepo, storage, cdn }
  }

  it('gives every photo a watermark-free thumbnail next to its download URL', async () => {
    const { handler } = setup()

    const result = await handler.execute(new GetDeliveryByTokenQuery(TOKEN))

    expect(result.photos).toEqual([
      {
        id: 'a',
        filename: 'photo-1.jpg',
        fileSize: 1000,
        downloadUrl: 'https://b2.test/photo-1.jpg',
        thumbnailUrl: 'https://cdn.test/thumb/slug-a?ttl=3600',
      },
      {
        id: 'b',
        filename: 'photo-2.jpg',
        fileSize: 1000,
        downloadUrl: 'https://b2.test/photo-2.jpg',
        thumbnailUrl: 'https://cdn.test/thumb/slug-b?ttl=3600',
      },
    ])
  })

  it('signs the thumbnail for as long as the download URL lives', async () => {
    const { handler, cdn, storage } = setup({ photos: [photo('a', 'slug-a')] })

    await handler.execute(new GetDeliveryByTokenQuery(TOKEN))

    expect(cdn.internalUrl).toHaveBeenCalledWith('slug-a', 'thumb', 3600)
    expect(storage.getPresignedDownloadUrl).toHaveBeenCalledWith(
      expect.objectContaining({ expiresIn: 3600 }),
    )
  })

  it('answers a null thumbnail for a photo without a slug and still returns the rest', async () => {
    const { handler, cdn } = setup({ photos: [photo('a', null), photo('b', 'slug-b')] })

    const result = await handler.execute(new GetDeliveryByTokenQuery(TOKEN))

    expect(result.photos.map((item) => item.thumbnailUrl)).toEqual([
      null,
      'https://cdn.test/thumb/slug-b?ttl=3600',
    ])
    expect(result.photos[0].downloadUrl).toBe('https://b2.test/photo-1.jpg')
    expect(cdn.internalUrl).toHaveBeenCalledTimes(1)
  })

  it('spends exactly one access of the link per request, thumbnails included', async () => {
    const { handler, writeRepo } = setup()

    await handler.execute(new GetDeliveryByTokenQuery(TOKEN))

    expect(writeRepo.tryRecordAccess).toHaveBeenCalledTimes(1)
    expect(writeRepo.tryRecordAccess).toHaveBeenCalledWith('link-1', 50)
  })

  it('signs nothing once the access cap is reached', async () => {
    const { handler, cdn, storage } = setup({ recorded: false })

    await expect(handler.execute(new GetDeliveryByTokenQuery(TOKEN))).rejects.toMatchObject({
      messageKey: 'delivery.access_limit_exceeded',
      httpStatus: 410,
    })
    expect(cdn.internalUrl).not.toHaveBeenCalled()
    expect(storage.getPresignedDownloadUrl).not.toHaveBeenCalled()
  })
})
