import { Inject } from '@nestjs/common'
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs'
import type { OrdersStatsProjection } from '@orders/application/projections'
import { type IOrderReadRepository, ORDER_READ_REPOSITORY } from '@orders/domain/ports'
import { GetOrdersStatsQuery } from './get-orders-stats.query'

@QueryHandler(GetOrdersStatsQuery)
export class GetOrdersStatsHandler implements IQueryHandler<GetOrdersStatsQuery> {
  constructor(
    @Inject(ORDER_READ_REPOSITORY)
    private readonly readRepo: IOrderReadRepository,
  ) {}

  async execute(query: GetOrdersStatsQuery): Promise<OrdersStatsProjection> {
    const [counts, totalRevenue] = await Promise.all([
      this.readRepo.countByStatus(query.eventId),
      this.readRepo.sumRevenue(query.eventId),
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
