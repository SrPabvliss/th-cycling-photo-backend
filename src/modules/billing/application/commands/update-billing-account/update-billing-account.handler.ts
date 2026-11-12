import { Inject } from '@nestjs/common'
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs'
import type { EntityIdProjection } from '@shared/application'
import { AppException } from '@shared/domain'
import { type IRikuchiyClient, RIKUCHIY_CLIENT } from '@shared/rikuchiy/domain/ports'
import { SRI_ID_TYPE } from '@shared/rikuchiy/domain/rikuchiy-emission-payload'
import { BILLING_ACCOUNT_REPOSITORY, type IBillingAccountRepository } from '../../../domain/ports'
import { UpdateBillingAccountCommand } from './update-billing-account.command'

@CommandHandler(UpdateBillingAccountCommand)
export class UpdateBillingAccountHandler implements ICommandHandler<UpdateBillingAccountCommand> {
  constructor(
    @Inject(BILLING_ACCOUNT_REPOSITORY)
    private readonly billingAccountRepository: IBillingAccountRepository,
    @Inject(RIKUCHIY_CLIENT) private readonly rikuchiyClient: IRikuchiyClient,
  ) {}

  async execute(command: UpdateBillingAccountCommand): Promise<EntityIdProjection> {
    const account = await this.billingAccountRepository.findActiveById(
      command.billingAccountId,
      command.userId,
    )
    if (!account) throw AppException.notFound('entities.billing_account', command.billingAccountId)

    const { identificationChanged } = account.update(command.changes)

    if (identificationChanged) {
      const check = await this.rikuchiyClient.validateIdentification(
        SRI_ID_TYPE[account.idType],
        account.idNumber,
      )
      if (check && !check.valid) {
        throw AppException.businessRule('billing.identification_invalid', false, {
          reason: check.reason,
        })
      }
    }

    await this.billingAccountRepository.save(account)
    return { id: account.id }
  }
}
