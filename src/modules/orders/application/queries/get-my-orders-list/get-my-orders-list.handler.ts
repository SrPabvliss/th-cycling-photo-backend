import { Inject } from '@nestjs/common'
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs'
import type { MyOrderListProjection } from '@orders/application/projections'
import { type IOrderReadRepository, ORDER_READ_REPOSITORY } from '@orders/domain/ports'
import type { PaginatedResult } from '@shared/application'
import { GetMyOrdersListQuery } from './get-my-orders-list.query'

@QueryHandler(GetMyOrdersListQuery)
export class GetMyOrdersListHandler implements IQueryHandler<GetMyOrdersListQuery> {
  constructor(@Inject(ORDER_READ_REPOSITORY) private readonly readRepo: IOrderReadRepository) {}

  async execute(query: GetMyOrdersListQuery): Promise<PaginatedResult<MyOrderListProjection>> {
    return this.readRepo.getMyList(query.userId, query.pagination)
  }
}
