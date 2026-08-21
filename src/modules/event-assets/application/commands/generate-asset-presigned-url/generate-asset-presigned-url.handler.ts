import { EVENT_READ_REPOSITORY, type IEventReadRepository } from '@events/domain/ports'
import { Inject } from '@nestjs/common'
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs'
import {
  AUTHORIZATION_SERVICE,
  type IAuthorizationService,
} from '@shared/authorization/domain/ports/authorization.service.port'
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
    @Inject(AUTHORIZATION_SERVICE) private readonly authz: IAuthorizationService,
  ) {}

  async execute(command: GenerateAssetPresignedUrlCommand): Promise<AssetPresignedUrlProjection> {
    if (command.assetType !== 'cover_image') {
      throw AppException.businessRule('event_asset.unsupported_type')
    }

    // Scoped load, then assert — see Ruling 21. The scoped load is what
    // enforces the tenant boundary; `assert` alone never compares the
    // event's tenant to the caller's.
    const scope = await this.authz.resolveEventScope(command.userId)
    const event = await this.eventReadRepo.findByIdInScope(command.eventId, scope)
    if (!event) throw AppException.notFound('Event', command.eventId)
    await this.authz.assert(command.userId, 'event_asset.presign', event.id)

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
