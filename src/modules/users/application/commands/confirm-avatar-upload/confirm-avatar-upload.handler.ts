import { Inject } from '@nestjs/common'
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs'
import type { EntityIdProjection } from '@shared/application'
import { AppException } from '@shared/domain'
import { type IStorageAdapter, STORAGE_ADAPTER } from '@shared/storage/domain/ports'
import type { IUserReadRepository, IUserWriteRepository } from '@users/domain/ports'
import { USER_READ_REPOSITORY, USER_WRITE_REPOSITORY } from '@users/domain/ports'
import { ConfirmAvatarUploadCommand } from './confirm-avatar-upload.command'

@CommandHandler(ConfirmAvatarUploadCommand)
export class ConfirmAvatarUploadHandler implements ICommandHandler<ConfirmAvatarUploadCommand> {
  constructor(
    @Inject(USER_READ_REPOSITORY) private readonly readRepo: IUserReadRepository,
    @Inject(USER_WRITE_REPOSITORY) private readonly writeRepo: IUserWriteRepository,
    @Inject(STORAGE_ADAPTER) private readonly storage: IStorageAdapter,
  ) {}

  async execute(command: ConfirmAvatarUploadCommand): Promise<EntityIdProjection> {
    const user = await this.readRepo.findById(command.userId)
    if (!user) throw AppException.notFound('User', command.userId)

    const expectedPrefix = `users/${command.userId}/avatar/`
    if (!command.storageKey.startsWith(expectedPrefix)) {
      throw AppException.businessRule('user.invalid_avatar_storage_key')
    }

    if (user.avatarStorageKey && user.avatarStorageKey !== command.storageKey) {
      await this.storage.delete(user.avatarStorageKey)
    }

    const url = this.storage.getPublicUrl(command.storageKey)
    user.setAvatar(url, command.storageKey)
    await this.writeRepo.save(user)

    return { id: user.id }
  }
}
