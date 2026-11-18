import { Inject } from '@nestjs/common'
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs'
import { AppException } from '@shared/domain'
import { OrderContactService } from '@shared/order-contact'
import type { UserPhoneSavedProjection } from '@users/application/projections/user-phone-saved.projection'
import { UserPhone } from '@users/domain/entities'
import type { IUserPhoneReadRepository, IUserPhoneWriteRepository } from '@users/domain/ports'
import { USER_PHONE_READ_REPOSITORY, USER_PHONE_WRITE_REPOSITORY } from '@users/domain/ports'
import { AddUserPhoneCommand } from './add-user-phone.command'

@CommandHandler(AddUserPhoneCommand)
export class AddUserPhoneHandler implements ICommandHandler<AddUserPhoneCommand> {
  constructor(
    @Inject(USER_PHONE_READ_REPOSITORY) private readonly readRepo: IUserPhoneReadRepository,
    @Inject(USER_PHONE_WRITE_REPOSITORY) private readonly writeRepo: IUserPhoneWriteRepository,
    private readonly orderContact: OrderContactService,
  ) {}

  async execute(command: AddUserPhoneCommand): Promise<UserPhoneSavedProjection> {
    const duplicate = await this.readRepo.findByUserIdAndNumber(command.userId, command.phoneNumber)
    if (duplicate) throw AppException.businessRule('user_phone.duplicate_number')

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

    // The first number of an account is its primary one: orders in progress had none to reach.
    const syncedOrders = phone.isPrimary
      ? await this.orderContact.syncOrdersInProgress(command.userId, saved.phoneNumber, {
          changedById: command.userId,
          source: 'customer',
        })
      : 0
    return { id: saved.id, syncedOrders }
  }
}
