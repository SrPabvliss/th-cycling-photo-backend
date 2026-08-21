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
    const [counts, totalRevenue] = await Promise.all([
      this.readRepo.countByStatus(query.eventId, scope),
      this.readRepo.sumRevenue(query.eventId, scope),
    ])

    const pending = counts.pending ?? 0
    const paymentInfoSent = counts.payment_info_sent ?? 0
    const paid = counts.paid ?? 0
    const delivered = counts.delivered ?? 0
    const gifted = counts.gifted ?? 0
    const cancelled = counts.cancelled ?? 0

    const total = pending + paymentInfoSent + paid + delivered + gifted + cancelled

    return {
      totalOrders: total,
      activeOrders: total - cancelled,
      pendingCount: pending,
      paymentInfoSentCount: paymentInfoSent,
      paidCount: paid + delivered,
      deliveredCount: delivered,
      giftedCount: gifted,
      cancelledCount: cancelled,
      totalRevenue,
    }
  }
}
