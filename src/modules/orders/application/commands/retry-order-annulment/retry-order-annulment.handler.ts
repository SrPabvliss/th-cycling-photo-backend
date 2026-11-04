import { Inject } from '@nestjs/common'
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs'
import { toOrderInvoice } from '@orders/application/projections'
import { type IOrderReadRepository, ORDER_READ_REPOSITORY } from '@orders/domain/ports'
import type { EntityIdProjection } from '@shared/application'
import {
  AUTHORIZATION_SERVICE,
  type IAuthorizationService,
} from '@shared/authorization/domain/ports/authorization.service.port'
import { AppException } from '@shared/domain'
import { PrismaService } from '@shared/infrastructure'
import {
  type IInvoiceRequester,
  type IOrderTaxDocumentRepository,
  type IRikuchiyOutboxRepository,
  ORDER_TAX_DOCUMENT_REPOSITORY,
  RIKUCHIY_INVOICE_REQUESTER,
  RIKUCHIY_OUTBOX_REPOSITORY,
} from '@shared/rikuchiy/domain/ports'
import { RetryOrderAnnulmentCommand } from './retry-order-annulment.command'

@CommandHandler(RetryOrderAnnulmentCommand)
export class RetryOrderAnnulmentHandler implements ICommandHandler<RetryOrderAnnulmentCommand> {
  constructor(
    @Inject(ORDER_READ_REPOSITORY) private readonly readRepo: IOrderReadRepository,
    @Inject(AUTHORIZATION_SERVICE) private readonly authz: IAuthorizationService,
    @Inject(RIKUCHIY_OUTBOX_REPOSITORY)
    private readonly rikuchiyOutboxRepository: IRikuchiyOutboxRepository,
    @Inject(ORDER_TAX_DOCUMENT_REPOSITORY)
    private readonly orderTaxDocumentRepository: IOrderTaxDocumentRepository,
    @Inject(RIKUCHIY_INVOICE_REQUESTER) private readonly invoiceRequester: IInvoiceRequester,
    private readonly prisma: PrismaService,
  ) {}

  async execute(command: RetryOrderAnnulmentCommand): Promise<EntityIdProjection> {
    const scope = await this.authz.resolveEventScope(command.userId)
    const order = await this.readRepo.findByIdInScope(command.orderId, scope)
    if (!order) throw AppException.notFound('entities.order', command.orderId)
    await this.authz.assert(command.userId, 'order.invoice.manage', order.eventId)

    const [rows, documents] = await Promise.all([
      this.rikuchiyOutboxRepository.findByOrder(command.orderId),
      this.orderTaxDocumentRepository.findByOrder(command.orderId),
    ])
    if (!toOrderInvoice(rows, documents)?.canRetryAnnulment) {
      throw AppException.conflict('order.invoice_annulment_not_retryable')
    }

    await this.prisma.$transaction(async (tx) => {
      if (!(await this.invoiceRequester.retryAnnulment(command.orderId, tx))) {
        throw AppException.conflict('order.invoice_annulment_not_retryable')
      }
    })

    return { id: command.orderId }
  }
}
