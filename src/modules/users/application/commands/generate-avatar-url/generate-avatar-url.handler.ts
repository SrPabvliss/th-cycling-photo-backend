import { Inject } from '@nestjs/common'
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs'
import { AppException } from '@shared/domain'
import { type IStorageAdapter, STORAGE_ADAPTER } from '@shared/storage/domain/ports'
import type { IUserReadRepository } from '@users/domain/ports'
import { USER_READ_REPOSITORY } from '@users/domain/ports'
import type { AvatarPresignedUrlProjection } from '../../projections'
import { GenerateAvatarUrlCommand } from './generate-avatar-url.command'

const PRESIGNED_URL_EXPIRY_SECONDS = 300

@CommandHandler(GenerateAvatarUrlCommand)
export class GenerateAvatarUrlHandler implements ICommandHandler<GenerateAvatarUrlCommand> {
  constructor(
    @Inject(USER_READ_REPOSITORY) private readonly readRepo: IUserReadRepository,
    @Inject(STORAGE_ADAPTER) private readonly storage: IStorageAdapter,
  ) {}

  async execute(command: GenerateAvatarUrlCommand): Promise<AvatarPresignedUrlProjection> {
    const user = await this.readRepo.findById(command.userId)
    if (!user) throw AppException.notFound('User', command.userId)

    const sanitizedFileName = command.fileName.replace(/[^a-zA-Z0-9._-]/g, '_')
    const objectKey = `users/${command.userId}/avatar/${sanitizedFileName}`

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
