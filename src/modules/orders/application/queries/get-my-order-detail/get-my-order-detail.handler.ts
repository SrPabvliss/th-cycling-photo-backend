import { Inject } from '@nestjs/common'
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs'
import type { MyOrderDetailProjection } from '@orders/application/projections'
import { type IOrderReadRepository, ORDER_READ_REPOSITORY } from '@orders/domain/ports'
import { AppException } from '@shared/domain'
import { GetMyOrderDetailQuery } from './get-my-order-detail.query'

@QueryHandler(GetMyOrderDetailQuery)
export class GetMyOrderDetailHandler implements IQueryHandler<GetMyOrderDetailQuery> {
  constructor(@Inject(ORDER_READ_REPOSITORY) private readonly readRepo: IOrderReadRepository) {}

  async execute(query: GetMyOrderDetailQuery): Promise<MyOrderDetailProjection> {
    const detail = await this.readRepo.getMyDetail(query.userId, query.orderId)
    if (!detail) throw AppException.notFound('entities.order', query.orderId)
    return detail
  }
}
