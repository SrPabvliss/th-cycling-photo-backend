import { Inject } from '@nestjs/common'
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs'
import { AppException } from '@shared/domain'
import { type IStorageAdapter, STORAGE_ADAPTER } from '@shared/storage/domain/ports'
import { type IUserReadRepository, USER_READ_REPOSITORY } from '@users/domain/ports'
import { GenerateWatermarkPresignedUrlCommand } from './generate-watermark-presigned-url.command'

const PRESIGNED_URL_EXPIRY_SECONDS = 300

@CommandHandler(GenerateWatermarkPresignedUrlCommand)
export class GenerateWatermarkPresignedUrlHandler
  implements ICommandHandler<GenerateWatermarkPresignedUrlCommand>
{
  constructor(
    @Inject(USER_READ_REPOSITORY) private readonly userRepo: IUserReadRepository,
    @Inject(STORAGE_ADAPTER) private readonly storage: IStorageAdapter,
  ) {}

  async execute(command: GenerateWatermarkPresignedUrlCommand) {
    const tenantId = await this.userRepo.findTenantId(command.actorUserId)
    if (!tenantId) throw AppException.forbidden('tenant.not_a_tenant_member')

    const sanitizedFileName = command.fileName.replace(/[^a-zA-Z0-9._-]/g, '_')
    const objectKey = `tenants/${tenantId}/watermark/${crypto.randomUUID()}-${sanitizedFileName}`

    const result = await this.storage.getPresignedUrl({
      key: objectKey,
      contentType: command.contentType,
      expiresIn: PRESIGNED_URL_EXPIRY_SECONDS,
    })

    return { url: result.url, objectKey: result.objectKey, expiresIn: result.expiresIn }
  }
}
