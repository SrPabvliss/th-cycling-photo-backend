import { ProcessPhotoClassificationCommand } from '@classifications/application/commands/process-photo-classification/process-photo-classification.command'
import { Processor, WorkerHost } from '@nestjs/bullmq'
import { Logger } from '@nestjs/common'
import { CommandBus } from '@nestjs/cqrs'
import type { Job } from 'bullmq'

export interface PhotoClassificationJobData {
  photoId: string
}

const CLASSIFICATION_CONCURRENCY = Number.parseInt(
  process.env.PHOTO_CLASSIFICATION_CONCURRENCY ?? '3',
  10,
)

@Processor('photo-classification', { concurrency: CLASSIFICATION_CONCURRENCY })
export class PhotoClassificationProcessor extends WorkerHost {
  private readonly logger = new Logger(PhotoClassificationProcessor.name)

  constructor(private readonly commandBus: CommandBus) {
    super()
  }

  async process(job: Job<PhotoClassificationJobData>): Promise<void> {
    const { photoId } = job.data
    this.logger.log(`Processing photo-classification ${photoId} (attempt ${job.attemptsMade + 1})`)
    try {
      await this.commandBus.execute(new ProcessPhotoClassificationCommand(photoId))
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      this.logger.error(`✘ ${photoId}: ${message}`)
      throw error
    }
  }
}
