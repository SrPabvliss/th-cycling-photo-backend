import { assertIdentificationValid } from '@billing/application/services/assert-identification-valid'
import { Inject } from '@nestjs/common'
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs'
import type { EntityIdProjection } from '@shared/application'
import { AppException } from '@shared/domain'
import { type IRikuchiyClient, RIKUCHIY_CLIENT } from '@shared/rikuchiy/domain/ports'
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

    await assertIdentificationValid(this.rikuchiyClient, account.idType, account.idNumber)

    await this.billingAccountRepository.save(account)
    return { id: account.id }
  }
}
