import type { ActiveDeliveryProjection } from '@deliveries/application/projections'
import {
  DELIVERY_LINK_READ_REPOSITORY,
  type IDeliveryLinkReadRepository,
} from '@deliveries/domain/ports'
import { Inject } from '@nestjs/common'
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs'
import { GetActiveDeliveriesQuery } from './get-active-deliveries.query'

@QueryHandler(GetActiveDeliveriesQuery)
export class GetActiveDeliveriesHandler implements IQueryHandler<GetActiveDeliveriesQuery> {
  constructor(
    @Inject(DELIVERY_LINK_READ_REPOSITORY)
    private readonly readRepo: IDeliveryLinkReadRepository,
  ) {}

  async execute(query: GetActiveDeliveriesQuery): Promise<ActiveDeliveryProjection[]> {
    if (query.orderIds.length === 0) return []

    const rows = await this.readRepo.findActiveByOrderIds(query.orderIds)

    return rows.map((row) => ({
      orderId: row.orderId,
      eventName: row.eventName,
      token: row.token,
    }))
  }
}
