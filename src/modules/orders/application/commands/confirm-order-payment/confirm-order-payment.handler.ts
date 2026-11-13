import { Inject } from '@nestjs/common'
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs'
import { NotificationsService } from '@notifications/application/services/notifications.service'
import {
  type IOrderReadRepository,
  type IOrderWriteRepository,
  ORDER_READ_REPOSITORY,
  ORDER_WRITE_REPOSITORY,
} from '@orders/domain/ports'
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
import {
  ConfirmOrderPaymentCommand,
  type ConfirmOrderPaymentResult,
} from './confirm-order-payment.command'

@CommandHandler(ConfirmOrderPaymentCommand)
export class ConfirmOrderPaymentHandler implements ICommandHandler<ConfirmOrderPaymentCommand> {
  constructor(
    @Inject(ORDER_WRITE_REPOSITORY) private readonly writeRepo: IOrderWriteRepository,
    @Inject(ORDER_READ_REPOSITORY) private readonly readRepo: IOrderReadRepository,
    @Inject(AUTHORIZATION_SERVICE) private readonly authz: IAuthorizationService,
    private readonly notifications: NotificationsService,
    private readonly prisma: PrismaService,
    @Inject(RIKUCHIY_INVOICE_REQUESTER) private readonly invoiceRequester: IInvoiceRequester,
  ) {}

  /**
   * Pays the order once, however many runs ask at the same time: the browser coming back from the
   * gateway and the sweep, two tabs, or two clicks of staff.
   *
   * The order row is locked and read again inside the transaction that pays it, so the second run
   * waits for the first to commit and then finds the order paid. What that run does then is the
   * caller's choice (`whenAlreadyPaid`): staff get the usual `order.not_pending`; the card payment
   * path ends quietly. Either way it saves nothing, requests no invoice and notifies no one.
   */
  async execute(command: ConfirmOrderPaymentCommand): Promise<ConfirmOrderPaymentResult> {
    // 1. Scoped load — the tenant-boundary check. `assert` alone never
    // compares the order's event to the caller's scope, so it must be the
    // scoped load, not the assert, that turns an out-of-scope id into 404.
    const scope = await this.authz.resolveEventScope(command.audit.userId, 'order.confirm_payment')
    const scoped = await this.readRepo.findByIdInScope(command.orderId, scope)
    if (!scoped) throw AppException.notFound('entities.order', command.orderId)
    await this.authz.assert(command.audit.userId, 'order.confirm_payment', scoped.eventId)

    // 2. Under the order's lock: read it again, confirm payment (pending → paid), save it and
    //    request its invoice. Only database writes happen here, so the lock is held briefly.
    const paid = await this.prisma.$transaction(async (tx) => {
      const order = await this.writeRepo.findByIdForUpdate(command.orderId, tx)
      if (!order) throw AppException.notFound('entities.order', command.orderId)

      if (order.isPaid && command.whenAlreadyPaid === 'skip') return null

      order.confirmPayment(command.audit.userId)
      await this.writeRepo.save(order, tx)
      await this.invoiceRequester.request(order.id, tx)
      return order
    })

    if (!paid) return { id: command.orderId, alreadyPaid: true }

    // 3. Get detail for notification
    const detail = await this.readRepo.getDetail(paid.id, scope)

    // 4. Emit notification, once committed and only from the run that paid
    this.notifications.emitOrderPaid({
      orderId: paid.id,
      eventId: paid.eventId,
      eventName: detail?.eventName ?? '',
      customerName: detail?.userName ?? '',
      confirmedBy: command.audit.userId,
      photoCount: detail?.photos?.length ?? 0,
      paidAt: paid.paidAt!,
    })

    return { id: paid.id }
  }
}
