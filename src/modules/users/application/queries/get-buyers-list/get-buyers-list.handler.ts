import { Inject } from '@nestjs/common'
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs'
import { PaginatedResult } from '@shared/application'
import { type IUserReadRepository, USER_READ_REPOSITORY } from '@users/domain/ports'
import type { BuyerListProjection } from '../../projections'
import { GetBuyersListQuery } from './get-buyers-list.query'

@QueryHandler(GetBuyersListQuery)
export class GetBuyersListHandler implements IQueryHandler<GetBuyersListQuery> {
  constructor(@Inject(USER_READ_REPOSITORY) private readonly userReadRepo: IUserReadRepository) {}

  async execute(query: GetBuyersListQuery): Promise<PaginatedResult<BuyerListProjection>> {
    return this.userReadRepo.getBuyersList(query.pagination, query.search)
  }
}
