import {
  EVENT_PAYOUT_METHOD_REPOSITORY,
  type IEventPayoutMethodRepository,
} from '@events/domain/ports'
import { Inject } from '@nestjs/common'
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs'
import { type OrderDetailProjection, toOrderPayoutMethod } from '@orders/application/projections'
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
    @Inject(EVENT_PAYOUT_METHOD_REPOSITORY)
    private readonly payoutRepo: IEventPayoutMethodRepository,
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

    const canSeePayout = await this.authz.can(query.userId, 'order.notify_payment', detail.eventId)
    if (!canSeePayout) return detail

    // the event snapshot, never the live tenant: editing the profile must not change an issued order
    const methods = await this.payoutRepo.findByEventId(detail.eventId)
    return {
      ...detail,
      payoutMethods: methods.filter((m) => m.isActive).map(toOrderPayoutMethod),
    }
  }
}
