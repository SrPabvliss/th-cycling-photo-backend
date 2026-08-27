import { Inject } from '@nestjs/common'
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs'
import { AppException } from '@shared/domain'
import {
  CONTRACT_REPOSITORY,
  type IContractRepository,
} from '../../../domain/ports/contract-repository.port'
import { RevokeContractCommand } from './revoke-contract.command'

@CommandHandler(RevokeContractCommand)
export class RevokeContractHandler implements ICommandHandler<RevokeContractCommand> {
  constructor(@Inject(CONTRACT_REPOSITORY) private readonly contractRepo: IContractRepository) {}

  async execute(command: RevokeContractCommand): Promise<void> {
    const contract = await this.contractRepo.findById(command.id)
    if (!contract) throw AppException.notFound('entities.tenant_contract', command.id)

    contract.assertRevocable()

    await this.contractRepo.revoke(contract.id)
  }
}
