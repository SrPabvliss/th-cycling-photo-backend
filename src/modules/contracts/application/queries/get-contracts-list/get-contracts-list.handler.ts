import { Inject } from '@nestjs/common'
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs'
import {
  CONTRACT_REPOSITORY,
  type IContractRepository,
} from '../../../domain/ports/contract-repository.port'
import type { ContractProjection } from '../../projections/contract.projection'
import { GetContractsListQuery } from './get-contracts-list.query'

@QueryHandler(GetContractsListQuery)
export class GetContractsListHandler implements IQueryHandler<GetContractsListQuery> {
  constructor(@Inject(CONTRACT_REPOSITORY) private readonly contractRepo: IContractRepository) {}

  async execute(_query: GetContractsListQuery): Promise<ContractProjection[]> {
    return this.contractRepo.listAll()
  }
}
