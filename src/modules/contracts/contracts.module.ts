import { AuthModule } from '@auth/auth.module'
import { MailModule } from '@mail/mail.module'
import { forwardRef, Module } from '@nestjs/common'
import { CqrsModule } from '@nestjs/cqrs'
import { NotificationsModule } from '@notifications/notifications.module'
import { UsersModule } from '@users/users.module'
import { AcceptContractHandler } from './application/commands/accept-contract/accept-contract.handler'
import { IssueContractHandler } from './application/commands/issue-contract/issue-contract.handler'
import { ResendContractHandler } from './application/commands/resend-contract/resend-contract.handler'
import { RevokeContractHandler } from './application/commands/revoke-contract/revoke-contract.handler'
import { GetContractByTokenHandler } from './application/queries/get-contract-by-token/get-contract-by-token.handler'
import { GetContractsListHandler } from './application/queries/get-contracts-list/get-contracts-list.handler'
import { GetMyContractsHandler } from './application/queries/get-my-contracts/get-my-contracts.handler'
import { CONTRACT_REPOSITORY } from './domain/ports/contract-repository.port'
import { ContractRepository } from './infrastructure/repositories/contract.repository'
import { ContractsController } from './presentation/controllers/contracts.controller'

const handlers = [
  IssueContractHandler,
  AcceptContractHandler,
  RevokeContractHandler,
  ResendContractHandler,
  GetContractByTokenHandler,
  GetContractsListHandler,
  GetMyContractsHandler,
]

@Module({
  imports: [CqrsModule, AuthModule, UsersModule, MailModule, forwardRef(() => NotificationsModule)],
  controllers: [ContractsController],
  providers: [
    ...handlers,
    {
      provide: CONTRACT_REPOSITORY,
      useClass: ContractRepository,
    },
  ],
  exports: [CONTRACT_REPOSITORY],
})
export class ContractsModule {}
