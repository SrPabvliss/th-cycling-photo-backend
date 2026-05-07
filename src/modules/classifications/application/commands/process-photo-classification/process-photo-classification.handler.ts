import { Inject, Logger } from '@nestjs/common'
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs'
import {
  type IPhotoReadRepository,
  type IPhotoWriteRepository,
  PHOTO_READ_REPOSITORY,
  PHOTO_WRITE_REPOSITORY,
} from '@photos/domain/ports'
import {
  CLASSIFICATION_PIPELINE_ADAPTER,
  type IClassificationPipelineAdapter,
} from '@shared/ai-pipeline'
import { AppException } from '@shared/domain'
import {
  type IStorageAdapter,
  STORAGE_ADAPTER,
} from '@shared/storage/domain/ports/storage-adapter.port'
import {
  type IPhotoClassificationWriteRepository,
  PHOTO_CLASSIFICATION_WRITE_REPOSITORY,
} from '../../../domain/ports'
import { PipelineResponseMapper } from '../../../infrastructure/mappers/pipeline-response.mapper'
import { ProcessPhotoClassificationCommand } from './process-photo-classification.command'

const ALLOWED_STATUSES = new Set(['pending', 'failed', 'processing'])
const RETRYABLE_AI_ERRORS = new Set(['ai_pipeline.service_unavailable'])

@CommandHandler(ProcessPhotoClassificationCommand)
export class ProcessPhotoClassificationHandler
  implements ICommandHandler<ProcessPhotoClassificationCommand>
{
  private readonly logger = new Logger(ProcessPhotoClassificationHandler.name)

  constructor(
    @Inject(PHOTO_READ_REPOSITORY) private readonly photoReadRepo: IPhotoReadRepository,
    @Inject(PHOTO_WRITE_REPOSITORY) private readonly photoWriteRepo: IPhotoWriteRepository,
    @Inject(STORAGE_ADAPTER) private readonly storage: IStorageAdapter,
    @Inject(CLASSIFICATION_PIPELINE_ADAPTER)
    private readonly pipeline: IClassificationPipelineAdapter,
    @Inject(PHOTO_CLASSIFICATION_WRITE_REPOSITORY)
    private readonly writeRepo: IPhotoClassificationWriteRepository,
  ) {}

  async execute(command: ProcessPhotoClassificationCommand): Promise<void> {
    const photo = await this.photoReadRepo.findById(command.photoId)
    if (!photo) throw AppException.notFound('Photo', command.photoId)

    if (!ALLOWED_STATUSES.has(photo.status)) {
      throw AppException.businessRule('photo.invalid_status_for_processing', false, {
        photoId: photo.id,
        currentStatus: photo.status,
        allowed: [...ALLOWED_STATUSES],
      })
    }

    photo.markProcessing()
    await this.photoWriteRepo.save(photo)

    const startedAt = new Date()
    try {
      const imageUrl = await this.storage.getPresignedDownloadUrl({
        key: photo.storageKey,
        expiresIn: 3600,
      })

      const response = await this.pipeline.classify({
        imageId: photo.id,
        imageUrl,
        eventId: photo.eventId,
        confidenceThreshold: 0.25,
      })

      const completedAt = new Date()
      const persistInput = PipelineResponseMapper.toPersistInput(
        photo.id,
        response,
        startedAt,
        completedAt,
      )
      await this.writeRepo.persistResult(persistInput)

      photo.markProcessed(response.imageWidth ?? null, response.imageHeight ?? null)
      await this.photoWriteRepo.save(photo)

      this.logger.log(
        `✔ ${photo.id} processed bibs=${response.bibReadings.length} colors=${response.colorAnalyses.length} totalMs=${response.timings.totalMs}`,
      )
    } catch (error) {
      if (error instanceof AppException && RETRYABLE_AI_ERRORS.has(error.messageKey)) {
        // Photo stays in 'processing'; BullMQ will retry.
        throw error
      }

      const errorMessage = error instanceof Error ? error.message : String(error)
      const messageKey =
        error instanceof AppException ? error.messageKey : 'photo.processing_unexpected_error'

      try {
        await this.writeRepo.persistFailure({
          photoId: photo.id,
          schemaVersion: null,
          errorMessage: `${messageKey}: ${errorMessage}`,
          startedAt,
        })
      } catch (failurePersistError) {
        this.logger.error(
          `persistFailure also failed for ${photo.id}: ${String(failurePersistError)}`,
        )
      }

      photo.markFailed()
      await this.photoWriteRepo.save(photo).catch((saveErr) => {
        this.logger.error(`markFailed save also failed for ${photo.id}: ${String(saveErr)}`)
      })

      throw error
    }
  }
}
