import { Processor, WorkerHost } from '@nestjs/bullmq'
import { Inject, Logger } from '@nestjs/common'
import { type IPhotoReadRepository, PHOTO_READ_REPOSITORY } from '@photos/domain/ports'
import { CdnUrlBuilder } from '@shared/cloudflare/infrastructure'
import { EMBEDDING_ADAPTER, type IEmbeddingAdapter } from '@shared/embeddings'
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service'
import type { Job } from 'bullmq'

export interface EmbeddingGenerationJobData {
  photoId: string
}

@Processor('embedding-generation')
export class EmbeddingGenerationProcessor extends WorkerHost {
  private readonly logger = new Logger(EmbeddingGenerationProcessor.name)

  constructor(
    @Inject(PHOTO_READ_REPOSITORY) private readonly photoReadRepo: IPhotoReadRepository,
    @Inject(EMBEDDING_ADAPTER) private readonly embeddingAdapter: IEmbeddingAdapter,
    private readonly prisma: PrismaService,
    private readonly cdn: CdnUrlBuilder,
  ) {
    super()
  }

  async process(job: Job<EmbeddingGenerationJobData>): Promise<void> {
    const { photoId } = job.data
    this.logger.log(`Generating embedding for photo ${photoId}`)

    try {
      const photo = await this.photoReadRepo.findById(photoId)
      if (!photo) {
        this.logger.warn(`Photo ${photoId} not found, skipping embedding generation`)
        return
      }

      // Download resized image (~200-400KB) from Worker via signed internal URL
      const imageUrl = this.cdn.internalUrl(photo.publicSlug, 'embedding')
      const response = await fetch(imageUrl)

      if (!response.ok) {
        throw new Error(`Failed to fetch image from CDN: ${response.status} ${response.statusText}`)
      }

      // Convert to base64 data URL for Voyage AI
      const buffer = Buffer.from(await response.arrayBuffer())
      const base64 = `data:image/jpeg;base64,${buffer.toString('base64')}`

      const result = await this.embeddingAdapter.generateImageEmbedding(base64)

      const vectorSql = `[${result.embedding.join(',')}]`
      await this.prisma.$executeRawUnsafe(
        'UPDATE "photos" SET "embedding" = $1::vector WHERE "id" = $2::uuid',
        vectorSql,
        photoId,
      )

      this.logger.log(`Embedding generated for photo ${photoId} (${result.totalTokens} tokens)`)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      const context = (error as { context?: Record<string, unknown> }).context
      this.logger.error(
        `Failed to generate embedding for photo ${photoId}: ${message}`,
        context ? JSON.stringify(context) : undefined,
      )
      throw error
    }
  }
}
