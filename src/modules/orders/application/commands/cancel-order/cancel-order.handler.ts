import { Inject } from '@nestjs/common'
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs'
import { isHeldByPayment } from '@orders/domain/payment-hold'
import {
  type IOrderReadRepository,
  type IOrderWriteRepository,
  ORDER_READ_REPOSITORY,
  ORDER_WRITE_REPOSITORY,
} from '@orders/domain/ports'
import type { EntityIdProjection } from '@shared/application'
import {
  AUTHORIZATION_SERVICE,
  type IAuthorizationService,
} from '@shared/authorization/domain/ports/authorization.service.port'
import { AppException } from '@shared/domain'
import { PrismaService } from '@shared/infrastructure'
import {
  type IInvoiceRequester,
  RIKUCHIY_INVOICE_REQUESTER,
} from '@shared/rikuchiy/domain/ports/invoice-requester.port'
import { CancelOrderCommand } from './cancel-order.command'

@CommandHandler(CancelOrderCommand)
export class CancelOrderHandler implements ICommandHandler<CancelOrderCommand> {
  constructor(
    @Inject(ORDER_WRITE_REPOSITORY) private readonly writeRepo: IOrderWriteRepository,
    @Inject(ORDER_READ_REPOSITORY) private readonly readRepo: IOrderReadRepository,
    @Inject(AUTHORIZATION_SERVICE) private readonly authz: IAuthorizationService,
    private readonly prisma: PrismaService,
    @Inject(RIKUCHIY_INVOICE_REQUESTER) private readonly invoiceRequester: IInvoiceRequester,
  ) {}

  async execute(command: CancelOrderCommand): Promise<EntityIdProjection> {
    const scope = await this.authz.resolveEventScope(command.userId, 'order.cancel')
    const scoped = await this.readRepo.findByIdInScope(command.orderId, scope)
    if (!scoped) throw AppException.notFound('entities.order', command.orderId)
    await this.authz.assert(command.userId, 'order.cancel', scoped.eventId)

    // Under the order's lock: read it again so a payment confirmed meanwhile is kept, not
    // overwritten by the copy loaded above, and refuse while the buyer's card charge is still
    // being answered or approved but not yet settled.
    const cancelled = await this.prisma.$transaction(async (tx) => {
      const order = await this.writeRepo.findByIdForUpdate(command.orderId, tx)
      if (!order) throw AppException.notFound('entities.order', command.orderId)

      const payments = await this.writeRepo.findPaymentsForUpdate(order.id, tx)
      if (isHeldByPayment(order, payments)) {
        throw AppException.businessRule('order.buyer_payment_in_progress')
      }

      order.cancel()
      await this.writeRepo.save(order, tx)
      await this.invoiceRequester.withdraw(order.id, 'cancelled', tx)
      return order
    })

    return { id: cancelled.id }
  }
}
