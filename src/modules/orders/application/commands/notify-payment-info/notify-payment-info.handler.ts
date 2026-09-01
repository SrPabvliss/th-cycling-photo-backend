import { EventBankAccountService } from '@events/application/services/event-bank-account.service'
import { Inject } from '@nestjs/common'
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs'
import type { PaymentInfoNotifiedProjection } from '@orders/application/projections'
import {
  type IOrderReadRepository,
  type IOrderWriteRepository,
  ORDER_READ_REPOSITORY,
  ORDER_WRITE_REPOSITORY,
} from '@orders/domain/ports'
import { customerFirstName } from '@orders/domain/services/customer-name'
import { buildPaymentInfoTemplate } from '@orders/domain/services/payment-info-template'
import {
  AUTHORIZATION_SERVICE,
  type IAuthorizationService,
} from '@shared/authorization/domain/ports/authorization.service.port'
import { AppException } from '@shared/domain'
import { NotifyPaymentInfoCommand } from './notify-payment-info.command'

@CommandHandler(NotifyPaymentInfoCommand)
export class NotifyPaymentInfoHandler implements ICommandHandler<NotifyPaymentInfoCommand> {
  constructor(
    @Inject(ORDER_WRITE_REPOSITORY) private readonly writeRepo: IOrderWriteRepository,
    @Inject(ORDER_READ_REPOSITORY) private readonly readRepo: IOrderReadRepository,
    @Inject(AUTHORIZATION_SERVICE) private readonly authz: IAuthorizationService,
    private readonly bankAccounts: EventBankAccountService,
  ) {}

  async execute(command: NotifyPaymentInfoCommand): Promise<PaymentInfoNotifiedProjection> {
    const scope = await this.authz.resolveEventScope(command.audit.userId)
    const order = await this.readRepo.findByIdInScope(command.orderId, scope)
    if (!order) throw AppException.notFound('entities.order', command.orderId)
    await this.authz.assert(command.audit.userId, 'order.notify_payment', order.eventId)

    order.notifyPaymentInfo(command.audit.userId)
    await this.writeRepo.save(order)

    // Built here rather than in the browser: a template assembled from a frontend constant sent
    // every organiser's buyer to the same account.
    const detail = await this.readRepo.getDetail(order.id, scope)
    const account = await this.bankAccounts.resolveForEvent(order.eventId)

    const whatsappTemplate = buildPaymentInfoTemplate({
      customerFirstName: customerFirstName(detail ?? {}),
      eventName: detail?.eventName ?? '',
      photoCount: detail?.photos?.length ?? 0,
      subtotal: detail?.subtotal === undefined ? null : Number(detail.subtotal),
      currency: detail?.snapCurrency ?? null,
      account,
    })

    return { id: order.id, whatsappTemplate }
  }
}
