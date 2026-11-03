import { Inject } from '@nestjs/common'
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs'
import type { EntityIdProjection } from '@shared/application'
import { AppException } from '@shared/domain'
import { BILLING_ACCOUNT_REPOSITORY, type IBillingAccountRepository } from '../../../domain/ports'
import { DeleteBillingAccountCommand } from './delete-billing-account.command'

@CommandHandler(DeleteBillingAccountCommand)
export class DeleteBillingAccountHandler implements ICommandHandler<DeleteBillingAccountCommand> {
  constructor(
    @Inject(BILLING_ACCOUNT_REPOSITORY)
    private readonly billingAccountRepository: IBillingAccountRepository,
  ) {}

  async execute(command: DeleteBillingAccountCommand): Promise<EntityIdProjection> {
    const account = await this.billingAccountRepository.findActiveById(
      command.billingAccountId,
      command.userId,
    )
    if (!account) throw AppException.notFound('entities.billing_account', command.billingAccountId)

    const wasDefault = account.isDefault
    account.markDeleted()
    await this.billingAccountRepository.save(account)

    if (wasDefault) {
      const remaining = await this.billingAccountRepository.findActiveByUser(command.userId)
      const newest = [...remaining].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0]
      if (newest) await this.billingAccountRepository.makeDefault(command.userId, newest.id)
    }

    return { id: account.id }
  }
}
