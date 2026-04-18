import { Inject } from '@nestjs/common'
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs'
import { PresignedUrlProjection } from '@photos/application/projections'
import { type IPhotoReadRepository, PHOTO_READ_REPOSITORY } from '@photos/domain/ports'
import { AppException } from '@shared/domain'
import { type IStorageAdapter, STORAGE_ADAPTER } from '@shared/storage/domain/ports'
import { GenerateRetouchedPresignedUrlCommand } from './generate-retouched-presigned-url.command'

const PRESIGNED_URL_EXPIRY_SECONDS = 300

@CommandHandler(GenerateRetouchedPresignedUrlCommand)
export class GenerateRetouchedPresignedUrlHandler
  implements ICommandHandler<GenerateRetouchedPresignedUrlCommand>
{
  constructor(
    @Inject(PHOTO_READ_REPOSITORY) private readonly photoReadRepo: IPhotoReadRepository,
    @Inject(STORAGE_ADAPTER) private readonly storage: IStorageAdapter,
  ) {}

  async execute(command: GenerateRetouchedPresignedUrlCommand): Promise<PresignedUrlProjection> {
    const photo = await this.photoReadRepo.findById(command.photoId)
    if (!photo) throw AppException.notFound('Photo', command.photoId)

    const sanitizedFileName = command.fileName.replace(/[^a-zA-Z0-9._-]/g, '_')
    const objectKey = `events/${photo.eventId}/retouched/${crypto.randomUUID()}-${sanitizedFileName}`

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
