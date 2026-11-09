import { Inject } from '@nestjs/common'
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs'
import {
  CONTRACT_REPOSITORY,
  type IContractRepository,
} from '../../../domain/ports/contract-repository.port'
import type { ContractProjection } from '../../projections/contract.projection'
import { GetMyContractsQuery } from './get-my-contracts.query'

@QueryHandler(GetMyContractsQuery)
export class GetMyContractsHandler implements IQueryHandler<GetMyContractsQuery> {
  constructor(@Inject(CONTRACT_REPOSITORY) private readonly contractRepo: IContractRepository) {}

  async execute(query: GetMyContractsQuery): Promise<ContractProjection[]> {
    return this.contractRepo.listByUser(query.userId)
  }
}
