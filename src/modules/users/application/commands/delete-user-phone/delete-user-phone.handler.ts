import { Inject } from '@nestjs/common'
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs'
import type { EntityIdProjection } from '@shared/application'
import { AppException } from '@shared/domain'
import type { IUserPhoneReadRepository, IUserPhoneWriteRepository } from '@users/domain/ports'
import { USER_PHONE_READ_REPOSITORY, USER_PHONE_WRITE_REPOSITORY } from '@users/domain/ports'
import { DeleteUserPhoneCommand } from './delete-user-phone.command'

@CommandHandler(DeleteUserPhoneCommand)
export class DeleteUserPhoneHandler implements ICommandHandler<DeleteUserPhoneCommand> {
  constructor(
    @Inject(USER_PHONE_READ_REPOSITORY) private readonly readRepo: IUserPhoneReadRepository,
    @Inject(USER_PHONE_WRITE_REPOSITORY) private readonly writeRepo: IUserPhoneWriteRepository,
  ) {}

  async execute(command: DeleteUserPhoneCommand): Promise<EntityIdProjection> {
    const phone = await this.readRepo.findById(command.phoneId)
    if (!phone) throw AppException.notFound('UserPhone', command.phoneId)
    if (phone.userId !== command.userId) throw AppException.notFound('UserPhone', command.phoneId)

    const count = await this.readRepo.countByUserId(command.userId)
    if (count <= 1) {
      throw AppException.businessRule('user_phone.cannot_delete_last_phone')
    }

    if (phone.isPrimary) {
      throw AppException.businessRule('user_phone.cannot_delete_primary_phone')
    }

    await this.writeRepo.delete(command.phoneId)
    return { id: command.phoneId }
  }
}
