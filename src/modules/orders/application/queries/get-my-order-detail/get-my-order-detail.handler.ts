import { Inject } from '@nestjs/common'
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs'
import { type MyOrderDetailProjection, toMyOrderInvoice } from '@orders/application/projections'
import { type IOrderReadRepository, ORDER_READ_REPOSITORY } from '@orders/domain/ports'
import { OrderInvoiceSyncService } from '@orders/infrastructure/services/order-invoice-sync.service'
import { AppException } from '@shared/domain'
import {
  type IOrderTaxDocumentRepository,
  type IRikuchiyOutboxRepository,
  ORDER_TAX_DOCUMENT_REPOSITORY,
  RIKUCHIY_OUTBOX_REPOSITORY,
} from '@shared/rikuchiy/domain/ports'
import { GetMyOrderDetailQuery } from './get-my-order-detail.query'

@QueryHandler(GetMyOrderDetailQuery)
export class GetMyOrderDetailHandler implements IQueryHandler<GetMyOrderDetailQuery> {
  constructor(
    @Inject(ORDER_READ_REPOSITORY) private readonly readRepo: IOrderReadRepository,
    @Inject(RIKUCHIY_OUTBOX_REPOSITORY)
    private readonly rikuchiyOutboxRepository: IRikuchiyOutboxRepository,
    @Inject(ORDER_TAX_DOCUMENT_REPOSITORY)
    private readonly orderTaxDocumentRepository: IOrderTaxDocumentRepository,
    private readonly orderInvoiceSyncService: OrderInvoiceSyncService,
  ) {}

  async execute(query: GetMyOrderDetailQuery): Promise<MyOrderDetailProjection> {
    if (!(await this.readRepo.existsOwnedBy(query.userId, query.orderId))) {
      throw AppException.notFound('entities.order', query.orderId)
    }

    await this.orderInvoiceSyncService.syncOrder(query.orderId)

    const detail = await this.readRepo.getMyDetail(query.userId, query.orderId)
    if (!detail) throw AppException.notFound('entities.order', query.orderId)

    const [rows, documents] = await Promise.all([
      this.rikuchiyOutboxRepository.findByOrder(query.orderId),
      this.orderTaxDocumentRepository.findByOrder(query.orderId),
    ])
    return { ...detail, invoice: toMyOrderInvoice(rows, documents) }
  }
}
