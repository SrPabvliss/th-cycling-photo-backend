import {
  EVENT_PAYOUT_METHOD_REPOSITORY,
  type IEventPayoutMethodRepository,
} from '@events/domain/ports'
import { Inject } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs'
import {
  type OrderDetailProjection,
  type RawOrderDetailProjection,
  toOrderInvoice,
  toOrderPayoutMethod,
} from '@orders/application/projections'
import { type IOrderReadRepository, ORDER_READ_REPOSITORY } from '@orders/domain/ports'
import { customerFirstName } from '@orders/domain/services/customer-name'
import { buildDeliveryTemplate } from '@orders/domain/services/delivery-template'
import { OrderInvoiceSyncService } from '@orders/infrastructure/services/order-invoice-sync.service'
import {
  AUTHORIZATION_SERVICE,
  type IAuthorizationService,
} from '@shared/authorization/domain/ports/authorization.service.port'
import { AppException } from '@shared/domain'
import {
  type IOrderTaxDocumentRepository,
  type IRikuchiyOutboxRepository,
  ORDER_TAX_DOCUMENT_REPOSITORY,
  RIKUCHIY_OUTBOX_REPOSITORY,
} from '@shared/rikuchiy/domain/ports'
import { GetOrderDetailQuery } from './get-order-detail.query'

@QueryHandler(GetOrderDetailQuery)
export class GetOrderDetailHandler implements IQueryHandler<GetOrderDetailQuery> {
  constructor(
    @Inject(ORDER_READ_REPOSITORY) private readonly readRepo: IOrderReadRepository,
    @Inject(AUTHORIZATION_SERVICE) private readonly authz: IAuthorizationService,
    @Inject(EVENT_PAYOUT_METHOD_REPOSITORY)
    private readonly payoutRepo: IEventPayoutMethodRepository,
    private readonly config: ConfigService,
    @Inject(RIKUCHIY_OUTBOX_REPOSITORY)
    private readonly rikuchiyOutboxRepository: IRikuchiyOutboxRepository,
    @Inject(ORDER_TAX_DOCUMENT_REPOSITORY)
    private readonly orderTaxDocumentRepository: IOrderTaxDocumentRepository,
    private readonly orderInvoiceSyncService: OrderInvoiceSyncService,
  ) {}

  private withDeliveryTemplate(
    detail: RawOrderDetailProjection,
  ): Omit<OrderDetailProjection, 'invoice'> {
    if (!detail.deliveryLink) return { ...detail, deliveryLink: null }

    const baseUrl = this.config.getOrThrow<string>('delivery.baseUrl')
    return {
      ...detail,
      deliveryLink: {
        ...detail.deliveryLink,
        whatsappTemplate: buildDeliveryTemplate(
          {
            customerFirstName: customerFirstName(detail),
            photoCount: detail.photos?.length ?? 0,
            deliveryUrl: `${baseUrl}/${detail.deliveryLink.token}`,
          },
          'resend',
        ),
      },
    }
  }

  /**
   * Retrieves a single order's detail, or throws 404 — including when the
   * order exists but its event is outside the caller's scope, so an
   * out-of-scope id cannot be distinguished from an unknown one.
   */
  async execute(query: GetOrderDetailQuery): Promise<OrderDetailProjection> {
    const scope = await this.authz.resolveEventScope(query.userId, 'order.read')
    const inScope = await this.readRepo.findByIdInScope(query.orderId, scope)
    if (!inScope) throw AppException.notFound('entities.order', query.orderId)

    await this.orderInvoiceSyncService.syncOrder(query.orderId)

    const detail = await this.readRepo.getDetail(query.orderId, scope)
    if (!detail) throw AppException.notFound('entities.order', query.orderId)

    const [rows, documents] = await Promise.all([
      this.rikuchiyOutboxRepository.findByOrder(query.orderId),
      this.orderTaxDocumentRepository.findByOrder(query.orderId),
    ])
    const withTemplate = {
      ...this.withDeliveryTemplate(detail),
      invoice: toOrderInvoice(rows, documents),
    }

    const canSeePayout = await this.authz.can(query.userId, 'order.notify_payment', detail.eventId)
    if (!canSeePayout) return withTemplate

    // the event snapshot, never the live tenant: editing the profile must not change an issued order
    const methods = await this.payoutRepo.findByEventId(detail.eventId)
    return {
      ...withTemplate,
      payoutMethods: methods.filter((m) => m.isActive).map(toOrderPayoutMethod),
    }
  }
}
