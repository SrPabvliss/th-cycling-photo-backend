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
import { AppException } from '@shared/domain'
import { ConfirmOrderPaymentCommand } from './confirm-order-payment.command'

@CommandHandler(ConfirmOrderPaymentCommand)
export class ConfirmOrderPaymentHandler implements ICommandHandler<ConfirmOrderPaymentCommand> {
  constructor(
    @Inject(ORDER_WRITE_REPOSITORY) private readonly writeRepo: IOrderWriteRepository,
    @Inject(ORDER_READ_REPOSITORY) private readonly readRepo: IOrderReadRepository,
    private readonly notifications: NotificationsService,
  ) {}

  async execute(command: ConfirmOrderPaymentCommand): Promise<EntityIdProjection> {
    // 1. Find order
    const order = await this.readRepo.findById(command.orderId)
    if (!order) throw AppException.notFound('entities.order', command.orderId)

    // 2. Confirm payment (pending → paid)
    order.confirmPayment(command.audit.userId)

    // 3. Save order
    await this.writeRepo.save(order)

    // 4. Get detail for notification
    const detail = await this.readRepo.getDetail(order.id)

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
