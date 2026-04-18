import { Inject } from '@nestjs/common'
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs'
import type { OrderListProjection } from '@orders/application/projections'
import { type IOrderReadRepository, ORDER_READ_REPOSITORY } from '@orders/domain/ports'
import type { PaginatedResult } from '@shared/application'
import { GetOrdersListQuery } from './get-orders-list.query'

@QueryHandler(GetOrdersListQuery)
export class GetOrdersListHandler implements IQueryHandler<GetOrdersListQuery> {
  constructor(@Inject(ORDER_READ_REPOSITORY) private readonly readRepo: IOrderReadRepository) {}

  async execute(query: GetOrdersListQuery): Promise<PaginatedResult<OrderListProjection>> {
    return this.readRepo.getList(query.pagination, query.filters)
  }
}
