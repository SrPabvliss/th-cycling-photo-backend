import { Inject } from '@nestjs/common'
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs'
import type { EntityIdProjection } from '@shared/application'
import { AppException } from '@shared/domain'
import { type IRikuchiyClient, RIKUCHIY_CLIENT } from '@shared/rikuchiy/domain/ports'
import { SRI_ID_TYPE } from '@shared/rikuchiy/domain/rikuchiy-emission-payload'
import { BillingAccount } from '../../../domain/entities/billing-account.entity'
import { BILLING_ACCOUNT_REPOSITORY, type IBillingAccountRepository } from '../../../domain/ports'
import { CreateBillingAccountCommand } from './create-billing-account.command'

@CommandHandler(CreateBillingAccountCommand)
export class CreateBillingAccountHandler implements ICommandHandler<CreateBillingAccountCommand> {
  constructor(
    @Inject(BILLING_ACCOUNT_REPOSITORY)
    private readonly billingAccountRepository: IBillingAccountRepository,
    @Inject(RIKUCHIY_CLIENT) private readonly rikuchiyClient: IRikuchiyClient,
  ) {}

  async execute(command: CreateBillingAccountCommand): Promise<EntityIdProjection> {
    const existing = await this.billingAccountRepository.findActiveByUser(command.userId)

    const account = BillingAccount.create({
      userId: command.userId,
      idType: command.idType,
      idNumber: command.idNumber,
      legalName: command.legalName,
      email: command.email,
      address: command.address,
      isDefault: existing.length === 0,
    })

    const check = await this.rikuchiyClient.validateIdentification(
      SRI_ID_TYPE[account.idType],
      account.idNumber,
    )
    if (check && !check.valid) {
      throw AppException.businessRule('billing.identification_invalid', false, {
        reason: check.reason,
      })
    }

    await this.billingAccountRepository.save(account)
    return { id: account.id }
  }
}
