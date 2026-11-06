import { BillingAccount } from '@billing/domain/entities/billing-account.entity'
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
  type IRikuchiyClient,
  type IRikuchiyOutboxRepository,
  ORDER_TAX_DOCUMENT_REPOSITORY,
  RIKUCHIY_CLIENT,
  RIKUCHIY_INVOICE_REQUESTER,
  RIKUCHIY_OUTBOX_REPOSITORY,
} from '@shared/rikuchiy/domain/ports'
import { SRI_ID_TYPE } from '@shared/rikuchiy/domain/rikuchiy-emission-payload'
import { CorrectOrderBillingCommand } from './correct-order-billing.command'

@CommandHandler(CorrectOrderBillingCommand)
export class CorrectOrderBillingHandler implements ICommandHandler<CorrectOrderBillingCommand> {
  constructor(
    @Inject(ORDER_READ_REPOSITORY) private readonly readRepo: IOrderReadRepository,
    @Inject(AUTHORIZATION_SERVICE) private readonly authz: IAuthorizationService,
    @Inject(RIKUCHIY_OUTBOX_REPOSITORY)
    private readonly rikuchiyOutboxRepository: IRikuchiyOutboxRepository,
    @Inject(ORDER_TAX_DOCUMENT_REPOSITORY)
    private readonly orderTaxDocumentRepository: IOrderTaxDocumentRepository,
    @Inject(RIKUCHIY_CLIENT) private readonly rikuchiyClient: IRikuchiyClient,
    @Inject(RIKUCHIY_INVOICE_REQUESTER) private readonly invoiceRequester: IInvoiceRequester,
    private readonly prisma: PrismaService,
  ) {}

  async execute(command: CorrectOrderBillingCommand): Promise<EntityIdProjection> {
    const scope = await this.authz.resolveEventScope(command.userId, 'order.invoice.manage')
    const order = await this.readRepo.findByIdInScope(command.orderId, scope)
    if (!order) throw AppException.notFound('entities.order', command.orderId)
    await this.authz.assert(command.userId, 'order.invoice.manage', order.eventId)

    const [rows, documents] = await Promise.all([
      this.rikuchiyOutboxRepository.findByOrder(command.orderId),
      this.orderTaxDocumentRepository.findByOrder(command.orderId),
    ])
    if (!toOrderInvoice(rows, documents)?.canCorrect) {
      throw AppException.conflict('order.invoice_not_correctable')
    }

    const buyer = BillingAccount.normalizeBuyer({
      idType: command.idType,
      idNumber: command.idNumber,
      legalName: command.legalName,
      email: command.email,
      address: command.address,
    })
    const check = await this.rikuchiyClient.validateIdentification(
      SRI_ID_TYPE[buyer.idType],
      buyer.idNumber,
    )
    if (check && !check.valid) {
      throw AppException.businessRule('billing.identification_invalid', false, {
        reason: check.reason,
      })
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { id: command.orderId },
        data: {
          snap_billing_id_type: buyer.idType,
          snap_billing_id_number: buyer.idNumber,
          snap_billing_legal_name: buyer.legalName,
          snap_billing_email: buyer.email,
          snap_billing_address: buyer.address,
        },
      })
      if (!(await this.invoiceRequester.correct(command.orderId, tx))) {
        throw AppException.conflict('order.invoice_not_correctable')
      }
    })

    return { id: command.orderId }
  }
}
