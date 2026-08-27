import { Inject } from '@nestjs/common'
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs'
import type { OrdersStatsProjection } from '@orders/application/projections'
import { type IOrderReadRepository, ORDER_READ_REPOSITORY } from '@orders/domain/ports'
import {
  AUTHORIZATION_SERVICE,
  type IAuthorizationService,
} from '@shared/authorization/domain/ports/authorization.service.port'
import { GetOrdersStatsQuery } from './get-orders-stats.query'

@QueryHandler(GetOrdersStatsQuery)
export class GetOrdersStatsHandler implements IQueryHandler<GetOrdersStatsQuery> {
  constructor(
    @Inject(ORDER_READ_REPOSITORY)
    private readonly readRepo: IOrderReadRepository,
    @Inject(AUTHORIZATION_SERVICE)
    private readonly authz: IAuthorizationService,
  ) {}

  /** Returns order statistics, scoped to the caller so a tenant never sees another tenant's revenue. */
  async execute(query: GetOrdersStatsQuery): Promise<OrdersStatsProjection> {
    const scope = await this.authz.resolveEventScope(query.userId)
    return this.readRepo.getStats({ eventId: query.eventId, search: query.search }, scope)
  }
}
