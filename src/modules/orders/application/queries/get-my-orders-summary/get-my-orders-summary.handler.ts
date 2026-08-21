import { Inject } from '@nestjs/common'
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs'
import type { MyOrdersSummaryProjection } from '@orders/application/projections'
import { type IOrderReadRepository, ORDER_READ_REPOSITORY } from '@orders/domain/ports'
import { GetMyOrdersSummaryQuery } from './get-my-orders-summary.query'

@QueryHandler(GetMyOrdersSummaryQuery)
export class GetMyOrdersSummaryHandler implements IQueryHandler<GetMyOrdersSummaryQuery> {
  constructor(@Inject(ORDER_READ_REPOSITORY) private readonly readRepo: IOrderReadRepository) {}

  async execute(query: GetMyOrdersSummaryQuery): Promise<MyOrdersSummaryProjection> {
    return this.readRepo.getMySummary(query.userId)
  }
}
