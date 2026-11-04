import { Inject } from '@nestjs/common'
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs'
import { isTaxDocumentDownloadable } from '@orders/application/projections'
import { type IOrderReadRepository, ORDER_READ_REPOSITORY } from '@orders/domain/ports'
import { OrderInvoiceSyncService } from '@orders/infrastructure/services/order-invoice-sync.service'
import type { EntityIdProjection } from '@shared/application'
import {
  AUTHORIZATION_SERVICE,
  type IAuthorizationService,
} from '@shared/authorization/domain/ports/authorization.service.port'
import { AppException } from '@shared/domain'
import { PrismaService } from '@shared/infrastructure'
import {
  type IOrderTaxDocumentRepository,
  type IRikuchiyClient,
  ORDER_TAX_DOCUMENT_REPOSITORY,
  RIKUCHIY_CLIENT,
} from '@shared/rikuchiy/domain/ports'
import { ResendOrderTaxDocumentCommand } from './resend-order-tax-document.command'

@CommandHandler(ResendOrderTaxDocumentCommand)
export class ResendOrderTaxDocumentHandler
  implements ICommandHandler<ResendOrderTaxDocumentCommand>
{
  constructor(
    @Inject(ORDER_READ_REPOSITORY) private readonly readRepo: IOrderReadRepository,
    @Inject(AUTHORIZATION_SERVICE) private readonly authz: IAuthorizationService,
    @Inject(ORDER_TAX_DOCUMENT_REPOSITORY)
    private readonly orderTaxDocumentRepository: IOrderTaxDocumentRepository,
    @Inject(RIKUCHIY_CLIENT) private readonly rikuchiyClient: IRikuchiyClient,
    private readonly orderInvoiceSyncService: OrderInvoiceSyncService,
    private readonly prisma: PrismaService,
  ) {}

  async execute(command: ResendOrderTaxDocumentCommand): Promise<EntityIdProjection> {
    const scope = await this.authz.resolveEventScope(command.userId)
    const order = await this.readRepo.findByIdInScope(command.orderId, scope)
    if (!order) throw AppException.notFound('entities.order', command.orderId)
    await this.authz.assert(command.userId, 'order.invoice.manage', order.eventId)

    const documents = await this.orderTaxDocumentRepository.findByOrder(command.orderId)
    const document = documents.find((candidate) => candidate.id === command.taxDocumentId)
    if (!document || !isTaxDocumentDownloadable(document)) {
      throw AppException.notFound('entities.tax_document', command.taxDocumentId)
    }

    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: command.userId },
      select: { first_name: true, last_name: true, email: true },
    })
    const name = [user.first_name, user.last_name].filter(Boolean).join(' ').trim() || user.email

    const result = await this.rikuchiyClient.resend(document.id, { id: command.userId, name })
    if (result === 'not_resendable') throw AppException.conflict('order.invoice_not_resendable')
    if (result === 'unavailable') throw AppException.externalService('rikuchiy')

    await this.orderInvoiceSyncService.syncOrder(command.orderId)
    return { id: document.id }
  }
}
