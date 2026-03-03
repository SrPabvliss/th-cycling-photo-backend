import { EVENT_READ_REPOSITORY, type IEventReadRepository } from '@events/domain/ports'
import { Inject } from '@nestjs/common'
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs'
import { Photo } from '@photos/domain/entities'
import { type IPhotoWriteRepository, PHOTO_WRITE_REPOSITORY } from '@photos/domain/ports'
import { AppException } from '@shared/domain'
import type { ConfirmBatchProjection } from '../../projections'
import { ConfirmPhotoBatchCommand } from './confirm-photo-batch.command'

@CommandHandler(ConfirmPhotoBatchCommand)
export class ConfirmPhotoBatchHandler implements ICommandHandler<ConfirmPhotoBatchCommand> {
  constructor(
    @Inject(EVENT_READ_REPOSITORY) private readonly eventReadRepo: IEventReadRepository,
    @Inject(PHOTO_WRITE_REPOSITORY) private readonly photoWriteRepo: IPhotoWriteRepository,
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

    const photos = command.photos.map((item) =>
      Photo.create({
        eventId: command.eventId,
        filename: item.fileName,
        storageKey: item.objectKey,
        fileSize: BigInt(item.fileSize),
        mimeType: item.contentType,
      }),
    )

    const confirmed = await this.photoWriteRepo.saveMany(photos)

    return { confirmed }
  }
}
