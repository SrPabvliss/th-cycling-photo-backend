import { Inject } from '@nestjs/common'
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs'
import { AppException } from '@shared/domain'
import { OrderContactService } from '@shared/order-contact'
import type { UserPhoneSavedProjection } from '@users/application/projections/user-phone-saved.projection'
import type { IUserPhoneReadRepository, IUserPhoneWriteRepository } from '@users/domain/ports'
import { USER_PHONE_READ_REPOSITORY, USER_PHONE_WRITE_REPOSITORY } from '@users/domain/ports'
import { SetPrimaryPhoneCommand } from './set-primary-phone.command'

@CommandHandler(SetPrimaryPhoneCommand)
export class SetPrimaryPhoneHandler implements ICommandHandler<SetPrimaryPhoneCommand> {
  constructor(
    @Inject(USER_PHONE_READ_REPOSITORY) private readonly readRepo: IUserPhoneReadRepository,
    @Inject(USER_PHONE_WRITE_REPOSITORY) private readonly writeRepo: IUserPhoneWriteRepository,
    private readonly orderContact: OrderContactService,
  ) {}

  async execute(command: SetPrimaryPhoneCommand): Promise<UserPhoneSavedProjection> {
    const phone = await this.readRepo.findById(command.phoneId)
    if (!phone) throw AppException.notFound('UserPhone', command.phoneId)
    if (phone.userId !== command.userId) throw AppException.notFound('UserPhone', command.phoneId)

    await this.writeRepo.setPrimary(command.userId, command.phoneId)

    // The number the organizer must write to is now this one, on the orders in progress too.
    const syncedOrders = await this.orderContact.syncOrdersInProgress(
      command.userId,
      phone.phoneNumber,
      { changedById: command.userId, source: 'customer' },
    )
    return { id: command.phoneId, syncedOrders }
  }
}
