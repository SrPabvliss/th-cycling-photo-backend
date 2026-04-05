import { Inject } from '@nestjs/common'
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs'
import type { EntityIdProjection } from '@shared/application'
import { AppException } from '@shared/domain'
import type { IUserPhoneReadRepository, IUserPhoneWriteRepository } from '@users/domain/ports'
import { USER_PHONE_READ_REPOSITORY, USER_PHONE_WRITE_REPOSITORY } from '@users/domain/ports'
import { UpdateUserPhoneCommand } from './update-user-phone.command'

@CommandHandler(UpdateUserPhoneCommand)
export class UpdateUserPhoneHandler implements ICommandHandler<UpdateUserPhoneCommand> {
  constructor(
    @Inject(USER_PHONE_READ_REPOSITORY) private readonly readRepo: IUserPhoneReadRepository,
    @Inject(USER_PHONE_WRITE_REPOSITORY) private readonly writeRepo: IUserPhoneWriteRepository,
  ) {}

  async execute(command: UpdateUserPhoneCommand): Promise<EntityIdProjection> {
    const phone = await this.readRepo.findById(command.phoneId)
    if (!phone) throw AppException.notFound('UserPhone', command.phoneId)
    if (phone.userId !== command.userId) throw AppException.notFound('UserPhone', command.phoneId)

    phone.update({
      phoneNumber: command.phoneNumber,
      label: command.label,
      isWhatsapp: command.isWhatsapp,
    })

    await this.writeRepo.save(phone)
    return { id: phone.id }
  }
}
