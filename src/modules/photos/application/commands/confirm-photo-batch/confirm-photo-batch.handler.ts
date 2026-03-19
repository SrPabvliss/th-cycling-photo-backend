import { EVENT_READ_REPOSITORY, type IEventReadRepository } from '@events/domain/ports'
import { InjectQueue } from '@nestjs/bullmq'
import { Inject, Logger } from '@nestjs/common'
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs'
import { Photo } from '@photos/domain/entities'
import { type IPhotoWriteRepository, PHOTO_WRITE_REPOSITORY } from '@photos/domain/ports'
import { AppException } from '@shared/domain'
import type { Queue } from 'bullmq'
import type { ConfirmBatchProjection } from '../../projections'
import { ConfirmPhotoBatchCommand } from './confirm-photo-batch.command'

@CommandHandler(ConfirmPhotoBatchCommand)
export class ConfirmPhotoBatchHandler implements ICommandHandler<ConfirmPhotoBatchCommand> {
  private readonly logger = new Logger(ConfirmPhotoBatchHandler.name)

  constructor(
    @Inject(EVENT_READ_REPOSITORY) private readonly eventReadRepo: IEventReadRepository,
    @Inject(PHOTO_WRITE_REPOSITORY) private readonly photoWriteRepo: IPhotoWriteRepository,
    @InjectQueue('embedding-generation') private readonly embeddingQueue: Queue,
  ) {}

  /** Validates event, checks objectKey prefixes, and batch-inserts photo metadata. */
  async execute(command: ConfirmPhotoBatchCommand): Promise<ConfirmBatchProjection> {
    const event = await this.eventReadRepo.findById(command.eventId)
    if (!event) throw AppException.notFound('Event', command.eventId)

    const expectedPrefix = `events/${command.eventId}/`
    for (const item of command.photos) {
      if (!item.objectKey.startsWith(expectedPrefix)) {
        throw AppException.businessRule('photo.invalid_object_key_prefix')
      }
    }

    const photos = command.photos.map((item) => {
      const photo = Photo.create({
        eventId: command.eventId,
        filename: item.fileName,
        storageKey: item.objectKey,
        fileSize: BigInt(item.fileSize),
        mimeType: item.contentType,
      })
      if (command.audit) photo.setCreatedBy(command.audit.userId)
      return photo
    })

    const confirmed = await this.photoWriteRepo.saveMany(photos)

    await this.embeddingQueue.addBulk(
      photos.map((photo) => ({
        name: 'generate-embedding',
        data: { photoId: photo.id },
        opts: { attempts: 3, backoff: { type: 'exponential', delay: 2000 } },
      })),
    )
    this.logger.log(`Enqueued ${photos.length} embedding generation jobs`)

    return { confirmed }
  }
}
