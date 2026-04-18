import { EVENT_READ_REPOSITORY, type IEventReadRepository } from '@events/domain/ports'
import { Inject } from '@nestjs/common'
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs'
import { PresignedUrlProjection } from '@photos/application/projections'
import { type IPhotoReadRepository, PHOTO_READ_REPOSITORY } from '@photos/domain/ports'
import { AppException } from '@shared/domain'
import { type IStorageAdapter, STORAGE_ADAPTER } from '@shared/storage/domain/ports'
import { GeneratePresignedUrlCommand } from './generate-presigned-url.command'

const PRESIGNED_URL_EXPIRY_SECONDS = 300

@CommandHandler(GeneratePresignedUrlCommand)
export class GeneratePresignedUrlHandler implements ICommandHandler<GeneratePresignedUrlCommand> {
  constructor(
    @Inject(EVENT_READ_REPOSITORY) private readonly eventReadRepo: IEventReadRepository,
    @Inject(PHOTO_READ_REPOSITORY) private readonly photoReadRepo: IPhotoReadRepository,
    @Inject(STORAGE_ADAPTER) private readonly storage: IStorageAdapter,
  ) {}

  /** Validates event existence, checks for duplicates, and generates a presigned upload URL. */
  async execute(command: GeneratePresignedUrlCommand): Promise<PresignedUrlProjection> {
    const event = await this.eventReadRepo.findById(command.eventId)
    if (!event) throw AppException.notFound('Event', command.eventId)

    const exists = await this.photoReadRepo.existsByEventAndFilename(
      command.eventId,
      command.fileName,
    )
    if (exists) {
      return { isDuplicate: true, url: null, objectKey: null, expiresIn: null }
    }

    const sanitizedFileName = command.fileName.replace(/[^a-zA-Z0-9._-]/g, '_')
    const objectKey = `events/${command.eventId}/photos/${crypto.randomUUID()}-${sanitizedFileName}`

    const result = await this.storage.getPresignedUrl({
      key: objectKey,
      contentType: command.contentType,
      expiresIn: PRESIGNED_URL_EXPIRY_SECONDS,
    })

    return {
      isDuplicate: false,
      url: result.url,
      objectKey: result.objectKey,
      expiresIn: result.expiresIn,
    }
  }
}
