import { Inject } from '@nestjs/common'
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs'
import type { OrderDetailProjection } from '@orders/application/projections'
import { type IOrderReadRepository, ORDER_READ_REPOSITORY } from '@orders/domain/ports'
import {
  AUTHORIZATION_SERVICE,
  type IAuthorizationService,
} from '@shared/authorization/domain/ports/authorization.service.port'
import { AppException } from '@shared/domain'
import { GetOrderDetailQuery } from './get-order-detail.query'

@QueryHandler(GetOrderDetailQuery)
export class GetOrderDetailHandler implements IQueryHandler<GetOrderDetailQuery> {
  constructor(
    @Inject(ORDER_READ_REPOSITORY) private readonly readRepo: IOrderReadRepository,
    @Inject(AUTHORIZATION_SERVICE) private readonly authz: IAuthorizationService,
  ) {}

  /**
   * Retrieves a single order's detail, or throws 404 — including when the
   * order exists but its event is outside the caller's scope, so an
   * out-of-scope id cannot be distinguished from an unknown one.
   */
  async execute(query: GetOrderDetailQuery): Promise<OrderDetailProjection> {
    const scope = await this.authz.resolveEventScope(query.userId)
    const detail = await this.readRepo.getDetail(query.orderId, scope)
    if (!detail) throw AppException.notFound('entities.order', query.orderId)
    return detail
  }
}
