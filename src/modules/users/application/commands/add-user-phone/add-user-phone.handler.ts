import { Inject } from '@nestjs/common'
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs'
import type { EntityIdProjection } from '@shared/application'
import { UserPhone } from '@users/domain/entities'
import type { IUserPhoneReadRepository, IUserPhoneWriteRepository } from '@users/domain/ports'
import { USER_PHONE_READ_REPOSITORY, USER_PHONE_WRITE_REPOSITORY } from '@users/domain/ports'
import { AddUserPhoneCommand } from './add-user-phone.command'

@CommandHandler(AddUserPhoneCommand)
export class AddUserPhoneHandler implements ICommandHandler<AddUserPhoneCommand> {
  constructor(
    @Inject(USER_PHONE_READ_REPOSITORY) private readonly readRepo: IUserPhoneReadRepository,
    @Inject(USER_PHONE_WRITE_REPOSITORY) private readonly writeRepo: IUserPhoneWriteRepository,
  ) {}

  async execute(command: AddUserPhoneCommand): Promise<EntityIdProjection> {
    const phone = UserPhone.create({
      userId: command.userId,
      phoneNumber: command.phoneNumber,
      label: command.label,
      isWhatsapp: command.isWhatsapp,
    })

    const count = await this.readRepo.countByUserId(command.userId)
    if (count === 0) {
      phone.isPrimary = true
    }

    const saved = await this.writeRepo.save(phone)
    return { id: saved.id }
  }
}
