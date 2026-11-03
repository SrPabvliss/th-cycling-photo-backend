import { Inject } from '@nestjs/common'
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs'
import type { EntityIdProjection } from '@shared/application'
import { AppException } from '@shared/domain'
import { BILLING_ACCOUNT_REPOSITORY, type IBillingAccountRepository } from '../../../domain/ports'
import { SetDefaultBillingAccountCommand } from './set-default-billing-account.command'

@CommandHandler(SetDefaultBillingAccountCommand)
export class SetDefaultBillingAccountHandler
  implements ICommandHandler<SetDefaultBillingAccountCommand>
{
  constructor(
    @Inject(BILLING_ACCOUNT_REPOSITORY)
    private readonly billingAccountRepository: IBillingAccountRepository,
  ) {}

  async execute(command: SetDefaultBillingAccountCommand): Promise<EntityIdProjection> {
    const account = await this.billingAccountRepository.findActiveById(
      command.billingAccountId,
      command.userId,
    )
    if (!account) throw AppException.notFound('entities.billing_account', command.billingAccountId)

    await this.billingAccountRepository.makeDefault(command.userId, account.id)
    return { id: account.id }
  }
}
