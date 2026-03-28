import { Inject } from '@nestjs/common'
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs'
import type { OrdersStatsProjection } from '@orders/application/projections'
import { type IOrderReadRepository, ORDER_READ_REPOSITORY } from '@orders/domain/ports'
import { GetOrdersStatsQuery } from './get-orders-stats.query'

@QueryHandler(GetOrdersStatsQuery)
export class GetOrdersStatsHandler implements IQueryHandler<GetOrdersStatsQuery> {
  constructor(@Inject(ORDER_READ_REPOSITORY) private readonly readRepo: IOrderReadRepository) {}

  async execute(): Promise<OrdersStatsProjection> {
    const counts = await this.readRepo.countByStatus()

    const pending = counts.pending ?? 0
    const paid = counts.paid ?? 0
    const delivered = counts.delivered ?? 0
    const cancelled = counts.cancelled ?? 0

    return {
      totalOrders: pending + paid + delivered + cancelled,
      pendingCount: pending,
      paidCount: paid + delivered,
      deliveredCount: delivered,
      cancelledCount: cancelled,
    }
  }
}
