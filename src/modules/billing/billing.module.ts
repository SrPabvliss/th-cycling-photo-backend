import { AuthModule } from '@auth/auth.module'
import { Module } from '@nestjs/common'
import { CqrsModule } from '@nestjs/cqrs'
import { CreateBillingAccountHandler } from './application/commands/create-billing-account/create-billing-account.handler'
import { DeleteBillingAccountHandler } from './application/commands/delete-billing-account/delete-billing-account.handler'
import { SetDefaultBillingAccountHandler } from './application/commands/set-default-billing-account/set-default-billing-account.handler'
import { GetMyBillingAccountsHandler } from './application/queries/get-my-billing-accounts/get-my-billing-accounts.handler'
import { BILLING_ACCOUNT_REPOSITORY } from './domain/ports'
import { BillingAccountRepository } from './infrastructure/repositories/billing-account.repository'
import { BillingAccountsController } from './presentation/controllers/billing-accounts.controller'

const CommandHandlers = [
  CreateBillingAccountHandler,
  SetDefaultBillingAccountHandler,
  DeleteBillingAccountHandler,
]

const QueryHandlers = [GetMyBillingAccountsHandler]

@Module({
  imports: [CqrsModule, AuthModule],
  controllers: [BillingAccountsController],
  providers: [
    ...CommandHandlers,
    ...QueryHandlers,
    { provide: BILLING_ACCOUNT_REPOSITORY, useClass: BillingAccountRepository },
  ],
  exports: [BILLING_ACCOUNT_REPOSITORY],
})
export class BillingModule {}
