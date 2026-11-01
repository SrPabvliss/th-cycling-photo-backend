import type { IPhotoReadRepository } from '@photos/domain/ports'
import type { CdnUrlBuilder } from '@shared/cloudflare/infrastructure'
import type { IEmbeddingAdapter } from '@shared/embeddings'
import type { PrismaService } from '@shared/infrastructure/prisma/prisma.service'
import type { IYupanaOutboxRepository } from '@shared/yupana/domain/ports'
import { EmbeddingGenerationProcessor } from './embedding-generation.processor'

describe('EmbeddingGenerationProcessor', () => {
  const photoId = '6f1c2a54-2f7e-4c4e-9a2b-1f0b8a2f3c11'
  const eventId = 'b0a7c9e2-5d3f-4a61-8e2c-7f9d1e4a6b22'
  const originalFetch = global.fetch
  const calls: string[] = []

  const photoReadRepo = {
    findById: jest.fn(async () => ({ id: photoId, eventId, publicSlug: 'slug' })),
  }
  const embeddingAdapter = { generateImageEmbedding: jest.fn() }
  const prisma = {
    $executeRawUnsafe: jest.fn(async () => {
      calls.push('update')
      return 1
    }),
  }
  const cdn = { internalUrl: jest.fn(() => 'http://cdn/internal') }
  const outbox = {
    enqueue: jest.fn(async () => {
      calls.push('enqueue')
    }),
  }

  const processor = () =>
    new EmbeddingGenerationProcessor(
      photoReadRepo as unknown as IPhotoReadRepository,
      embeddingAdapter as IEmbeddingAdapter,
      prisma as unknown as PrismaService,
      cdn as unknown as CdnUrlBuilder,
      outbox as unknown as IYupanaOutboxRepository,
    )

  const job = { data: { photoId } } as never

  beforeEach(() => {
    jest.clearAllMocks()
    calls.length = 0
    global.fetch = jest.fn(async () => ({
      ok: true,
      arrayBuffer: async () => new ArrayBuffer(4),
    })) as unknown as typeof fetch
  })

  afterAll(() => {
    global.fetch = originalFetch
  })

  it('reports the pixels to yupana before storing the embedding', async () => {
    embeddingAdapter.generateImageEmbedding.mockResolvedValueOnce({
      embedding: [0.1],
      totalTokens: 3046,
      imagePixels: 1705600,
    })

    await processor().process(job)

    expect(calls).toEqual(['enqueue', 'update'])
    const [[entries]] = outbox.enqueue.mock.calls as unknown as [[{ payload: unknown }[]]]
    expect(entries[0].payload).toMatchObject({
      provider: 'voyage',
      payload: {
        meter: 'embedding.image_pixels',
        quantity: 1705600,
        subject: { photo_id: photoId, domain_event_id: eventId },
      },
    })
  })

  it('keeps the report when storing the embedding fails', async () => {
    embeddingAdapter.generateImageEmbedding.mockResolvedValueOnce({
      embedding: [0.1],
      totalTokens: 3046,
      imagePixels: 1705600,
    })
    prisma.$executeRawUnsafe.mockRejectedValueOnce(new Error('database down'))

    await expect(processor().process(job)).rejects.toThrow('database down')

    expect(outbox.enqueue).toHaveBeenCalledTimes(1)
  })
})
