import { Inject } from '@nestjs/common'
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs'
import { NotificationsService } from '@notifications/application/services/notifications.service'
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
import { ConfirmOrderPaymentCommand } from './confirm-order-payment.command'

@CommandHandler(ConfirmOrderPaymentCommand)
export class ConfirmOrderPaymentHandler implements ICommandHandler<ConfirmOrderPaymentCommand> {
  constructor(
    @Inject(ORDER_WRITE_REPOSITORY) private readonly writeRepo: IOrderWriteRepository,
    @Inject(ORDER_READ_REPOSITORY) private readonly readRepo: IOrderReadRepository,
    @Inject(AUTHORIZATION_SERVICE) private readonly authz: IAuthorizationService,
    private readonly notifications: NotificationsService,
  ) {}

  async execute(command: ConfirmOrderPaymentCommand): Promise<EntityIdProjection> {
    // 1. Scoped load — the tenant-boundary check. `assert` alone never
    // compares the order's event to the caller's scope, so it must be the
    // scoped load, not the assert, that turns an out-of-scope id into 404.
    const scope = await this.authz.resolveEventScope(command.audit.userId)
    const order = await this.readRepo.findByIdInScope(command.orderId, scope)
    if (!order) throw AppException.notFound('entities.order', command.orderId)
    await this.authz.assert(command.audit.userId, 'order.confirm_payment', order.eventId)

    // 2. Confirm payment (pending → paid)
    order.confirmPayment(command.audit.userId)

    // 3. Save order
    await this.writeRepo.save(order)

    // 4. Get detail for notification
    const detail = await this.readRepo.getDetail(order.id, scope)

    // 5. Emit notification
    this.notifications.emitOrderPaid({
      orderId: order.id,
      eventId: order.eventId,
      eventName: detail?.eventName ?? '',
      customerName: detail?.userName ?? '',
      confirmedBy: command.audit.userId,
      photoCount: detail?.photos?.length ?? 0,
      paidAt: order.paidAt!,
    })

    return { id: order.id }
  }
}
