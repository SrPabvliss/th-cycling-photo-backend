import { EVENT_READ_REPOSITORY, type IEventReadRepository } from '@events/domain/ports'
import { Inject } from '@nestjs/common'
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs'
import { AppException } from '@shared/domain'
import { type IStorageAdapter, STORAGE_ADAPTER } from '@shared/storage/domain/ports'
import type { AssetPresignedUrlProjection } from '../../projections'
import { GenerateAssetPresignedUrlCommand } from './generate-asset-presigned-url.command'

const PRESIGNED_URL_EXPIRY_SECONDS = 300

@CommandHandler(GenerateAssetPresignedUrlCommand)
export class GenerateAssetPresignedUrlHandler
  implements ICommandHandler<GenerateAssetPresignedUrlCommand>
{
  constructor(
    @Inject(EVENT_READ_REPOSITORY) private readonly eventReadRepo: IEventReadRepository,
    @Inject(STORAGE_ADAPTER) private readonly storage: IStorageAdapter,
  ) {}

  async execute(command: GenerateAssetPresignedUrlCommand): Promise<AssetPresignedUrlProjection> {
    const event = await this.eventReadRepo.findById(command.eventId)
    if (!event) throw AppException.notFound('Event', command.eventId)

    const sanitizedFileName = command.fileName.replace(/[^a-zA-Z0-9._-]/g, '_')
    const objectKey = `events/${command.eventId}/assets/${command.assetType}/${crypto.randomUUID()}-${sanitizedFileName}`

    const result = await this.storage.getPresignedUrl({
      key: objectKey,
      contentType: command.contentType,
      expiresIn: PRESIGNED_URL_EXPIRY_SECONDS,
    })

    return {
      url: result.url,
      objectKey: result.objectKey,
      expiresIn: result.expiresIn,
    }
  }
}
