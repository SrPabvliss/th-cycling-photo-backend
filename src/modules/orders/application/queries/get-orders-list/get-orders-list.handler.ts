import { Inject } from '@nestjs/common'
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs'
import type { OrderListProjection } from '@orders/application/projections'
import { type IOrderReadRepository, ORDER_READ_REPOSITORY } from '@orders/domain/ports'
import type { PaginatedResult } from '@shared/application'
import {
  AUTHORIZATION_SERVICE,
  type IAuthorizationService,
} from '@shared/authorization/domain/ports/authorization.service.port'
import { GetOrdersListQuery } from './get-orders-list.query'

@QueryHandler(GetOrdersListQuery)
export class GetOrdersListHandler implements IQueryHandler<GetOrdersListQuery> {
  constructor(
    @Inject(ORDER_READ_REPOSITORY) private readonly readRepo: IOrderReadRepository,
    @Inject(AUTHORIZATION_SERVICE) private readonly authz: IAuthorizationService,
  ) {}

  /** Retrieves a paginated list of orders, restricted to events within the caller's scope. */
  async execute(query: GetOrdersListQuery): Promise<PaginatedResult<OrderListProjection>> {
    const scope = await this.authz.resolveEventScope(query.userId)
    return this.readRepo.getList(query.pagination, query.filters, scope)
  }
}
