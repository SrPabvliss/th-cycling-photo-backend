import { Inject, Logger } from '@nestjs/common'
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs'
import {
  type IPhotoClassificationQueue,
  type IPhotoWriteRepository,
  PHOTO_CLASSIFICATION_QUEUE,
  PHOTO_WRITE_REPOSITORY,
} from '@photos/domain/ports'
import { ReapStalledPhotosCommand } from './reap-stalled-photos.command'

@CommandHandler(ReapStalledPhotosCommand)
export class ReapStalledPhotosHandler implements ICommandHandler<ReapStalledPhotosCommand> {
  static readonly STALLED_AFTER_MS = 15 * 60_000

  private readonly logger = new Logger(ReapStalledPhotosHandler.name)

  constructor(
    @Inject(PHOTO_WRITE_REPOSITORY) private readonly photoWriteRepo: IPhotoWriteRepository,
    @Inject(PHOTO_CLASSIFICATION_QUEUE)
    private readonly classificationQueue: IPhotoClassificationQueue,
  ) {}

  async execute(command: ReapStalledPhotosCommand): Promise<string[]> {
    const olderThan = new Date(command.now.getTime() - ReapStalledPhotosHandler.STALLED_AFTER_MS)
    const live = await this.classificationQueue.getLivePhotoIds()
    const reaped = await this.photoWriteRepo.markStalledAsFailed(olderThan, [...live])
    if (reaped.length > 0) {
      this.logger.warn(
        `Marked ${reaped.length} photos stuck in processing as failed (photo.processing_stalled): ${reaped.join(', ')}`,
      )
    }
    return reaped
  }
}
