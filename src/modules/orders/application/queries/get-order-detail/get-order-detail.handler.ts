import { Inject } from '@nestjs/common'
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs'
import type { OrderDetailProjection } from '@orders/application/projections'
import { type IOrderReadRepository, ORDER_READ_REPOSITORY } from '@orders/domain/ports'
import { AppException } from '@shared/domain'
import { GetOrderDetailQuery } from './get-order-detail.query'

@QueryHandler(GetOrderDetailQuery)
export class GetOrderDetailHandler implements IQueryHandler<GetOrderDetailQuery> {
  constructor(@Inject(ORDER_READ_REPOSITORY) private readonly readRepo: IOrderReadRepository) {}

  async execute(query: GetOrderDetailQuery): Promise<OrderDetailProjection> {
    const detail = await this.readRepo.getDetail(query.orderId)
    if (!detail) throw AppException.notFound('entities.order', query.orderId)
    return detail
  }
}
