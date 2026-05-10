import type { PhotoStatus } from '@generated/prisma/client'
import type { IPhotoReadRepository } from '@photos/domain/ports'
import { PaginatedResult, Pagination } from '@shared/application'
import type { CdnUrlBuilder } from '@shared/cloudflare/infrastructure'
import { GetReviewQueueHandler } from './get-review-queue.handler'
import { GetReviewQueueQuery } from './get-review-queue.query'

describe('GetReviewQueueHandler', () => {
  let handler: GetReviewQueueHandler
  let readRepo: jest.Mocked<Pick<IPhotoReadRepository, 'getReviewQueue'>>
  let cdn: jest.Mocked<Pick<CdnUrlBuilder, 'internalUrl'>>

  beforeEach(() => {
    readRepo = { getReviewQueue: jest.fn() }
    cdn = { internalUrl: jest.fn().mockReturnValue('https://cdn.test/thumb/x.jpg') }
    handler = new GetReviewQueueHandler(readRepo as never, cdn as never)
  })

  it('returns empty PaginatedResult when no items', async () => {
    readRepo.getReviewQueue.mockResolvedValue({ items: [], total: 0 })
    const pagination = new Pagination(1, 50)
    const result = await handler.execute(new GetReviewQueueQuery('e-1', pagination, true))
    expect(result).toBeInstanceOf(PaginatedResult)
    expect(result.items).toEqual([])
    expect(result.total).toBe(0)
    expect(result.pagination).toBe(pagination)
    expect(result.totalPages).toBe(0)
  })

  it('passes pagination skip/take and onlyPending to repository', async () => {
    readRepo.getReviewQueue.mockResolvedValue({ items: [], total: 0 })
    await handler.execute(new GetReviewQueueQuery('e-1', new Pagination(1, 50), true))
    expect(readRepo.getReviewQueue).toHaveBeenCalledWith({
      eventSlug: 'e-1',
      onlyPending: true,
      limit: 50,
      offset: 0,
    })
  })

  it('computes offset from page and limit via Pagination', async () => {
    readRepo.getReviewQueue.mockResolvedValue({ items: [], total: 0 })
    await handler.execute(new GetReviewQueueQuery('e-1', new Pagination(3, 20), true))
    expect(readRepo.getReviewQueue).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 20, offset: 40 }),
    )
  })

  it('builds thumbnail URLs via CDN from public slug and returns PaginatedResult', async () => {
    readRepo.getReviewQueue.mockResolvedValue({
      items: [
        {
          id: 'p-1',
          publicSlug: 's-1',
          filename: 'a.jpg',
          status: 'processed' as PhotoStatus,
          reviewedAt: null,
          minBibConfidence: 0.5,
          bibsCount: 1,
          colorsCount: 0,
        },
        {
          id: 'p-2',
          publicSlug: 's-2',
          filename: 'b.jpg',
          status: 'processed' as PhotoStatus,
          reviewedAt: null,
          minBibConfidence: null,
          bibsCount: 0,
          colorsCount: 0,
        },
      ],
      total: 2,
    })
    cdn.internalUrl.mockImplementation((slug: string) => `https://cdn.test/thumb/${slug}.jpg`)

    const pagination = new Pagination(1, 50)
    const result = await handler.execute(new GetReviewQueueQuery('e-1', pagination, true))
    expect(result).toBeInstanceOf(PaginatedResult)
    expect(cdn.internalUrl).toHaveBeenCalledWith('s-1', 'thumb')
    expect(cdn.internalUrl).toHaveBeenCalledWith('s-2', 'thumb')
    expect(result.items[0].thumbnailUrl).toBe('https://cdn.test/thumb/s-1.jpg')
    expect(result.items[1].thumbnailUrl).toBe('https://cdn.test/thumb/s-2.jpg')
    expect(result.total).toBe(2)
    expect(result.pagination).toBe(pagination)
    expect(result.totalPages).toBe(1)
  })

  it('passes through onlyPending=false when explicitly set', async () => {
    readRepo.getReviewQueue.mockResolvedValue({ items: [], total: 0 })
    await handler.execute(new GetReviewQueueQuery('e-1', new Pagination(1, 50), false))
    expect(readRepo.getReviewQueue).toHaveBeenCalledWith(
      expect.objectContaining({ onlyPending: false }),
    )
  })
})
