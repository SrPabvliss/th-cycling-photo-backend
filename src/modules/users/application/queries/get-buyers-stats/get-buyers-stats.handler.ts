import { Inject } from '@nestjs/common'
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs'
import {
  type BuyerListFilters,
  type IUserReadRepository,
  USER_READ_REPOSITORY,
} from '@users/domain/ports'
import type { BuyersStatsProjection } from '../../projections'
import { GetBuyersStatsQuery } from './get-buyers-stats.query'

@QueryHandler(GetBuyersStatsQuery)
export class GetBuyersStatsHandler implements IQueryHandler<GetBuyersStatsQuery> {
  constructor(@Inject(USER_READ_REPOSITORY) private readonly userReadRepo: IUserReadRepository) {}

  async execute(query: GetBuyersStatsQuery): Promise<BuyersStatsProjection> {
    const filters: BuyerListFilters = {
      ...query.filters,
      purchase: query.filters.purchase ?? 'all',
    }

    return this.userReadRepo.getBuyersStats(filters)
  }
}
