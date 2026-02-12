import { EVENT_READ_REPOSITORY, type IEventReadRepository } from '@events/domain/ports'
import { Inject } from '@nestjs/common'
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs'
import { Photo } from '@photos/domain/entities'
import { type IPhotoWriteRepository, PHOTO_WRITE_REPOSITORY } from '@photos/domain/ports'
import type { EntityIdProjection } from '@shared/application'
import { AppException } from '@shared/domain'
import {
  type IStorageAdapter,
  STORAGE_ADAPTER,
} from '@shared/storage/domain/ports/storage-adapter.port'
import { UploadPhotosCommand } from './upload-photos.command'

@CommandHandler(UploadPhotosCommand)
export class UploadPhotosHandler implements ICommandHandler<UploadPhotosCommand> {
  constructor(
    @Inject(EVENT_READ_REPOSITORY) private readonly eventReadRepo: IEventReadRepository,
    @Inject(PHOTO_WRITE_REPOSITORY) private readonly photoWriteRepo: IPhotoWriteRepository,
    @Inject(STORAGE_ADAPTER) private readonly storageAdapter: IStorageAdapter,
  ) {}

  async execute(command: UploadPhotosCommand): Promise<EntityIdProjection[]> {
    const event = await this.eventReadRepo.findById(command.eventId)
    if (!event) throw AppException.notFound('Event', command.eventId)

    const results: EntityIdProjection[] = []

    for (const file of command.files) {
      const fileUuid = crypto.randomUUID()
      const ext = this.extractExtension(file.originalname)
      const storageKey = `events/${command.eventId}/photos/${fileUuid}.${ext}`

      const photo = Photo.create({
        eventId: command.eventId,
        filename: file.originalname,
        storageKey,
        fileSize: BigInt(file.size),
        mimeType: file.mimetype,
      })

      await this.storageAdapter.upload({
        buffer: file.buffer,
        key: storageKey,
        contentType: file.mimetype,
      })

      const saved = await this.photoWriteRepo.save(photo)
      results.push({ id: saved.id })
    }

    return results
  }

  private extractExtension(filename: string): string {
    const lastDot = filename.lastIndexOf('.')
    return lastDot !== -1 ? filename.slice(lastDot + 1).toLowerCase() : 'jpg'
  }
}
