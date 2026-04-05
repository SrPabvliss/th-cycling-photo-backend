import { Inject } from '@nestjs/common'
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs'
import type { EntityIdProjection } from '@shared/application'
import { AppException } from '@shared/domain'
import type { IUserPhoneReadRepository, IUserPhoneWriteRepository } from '@users/domain/ports'
import { USER_PHONE_READ_REPOSITORY, USER_PHONE_WRITE_REPOSITORY } from '@users/domain/ports'
import { SetPrimaryPhoneCommand } from './set-primary-phone.command'

@CommandHandler(SetPrimaryPhoneCommand)
export class SetPrimaryPhoneHandler implements ICommandHandler<SetPrimaryPhoneCommand> {
  constructor(
    @Inject(USER_PHONE_READ_REPOSITORY) private readonly readRepo: IUserPhoneReadRepository,
    @Inject(USER_PHONE_WRITE_REPOSITORY) private readonly writeRepo: IUserPhoneWriteRepository,
  ) {}

  async execute(command: SetPrimaryPhoneCommand): Promise<EntityIdProjection> {
    const phone = await this.readRepo.findById(command.phoneId)
    if (!phone) throw AppException.notFound('UserPhone', command.phoneId)
    if (phone.userId !== command.userId) throw AppException.notFound('UserPhone', command.phoneId)

    await this.writeRepo.setPrimary(command.userId, command.phoneId)
    return { id: command.phoneId }
  }
}
