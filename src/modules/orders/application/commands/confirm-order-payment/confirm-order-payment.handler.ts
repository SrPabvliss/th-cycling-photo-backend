import { CreateDeliveryLinkCommand } from '@deliveries/application/commands'
import type { DeliveryLinkCreatedProjection } from '@deliveries/application/projections'
import { Inject } from '@nestjs/common'
import { CommandBus, CommandHandler, type ICommandHandler } from '@nestjs/cqrs'
import type { OrderPaymentConfirmedProjection } from '@orders/application/projections'
import {
  type IOrderReadRepository,
  type IOrderWriteRepository,
  ORDER_READ_REPOSITORY,
  ORDER_WRITE_REPOSITORY,
} from '@orders/domain/ports'
import { AppException } from '@shared/domain'
import { NotificationsService } from '@shared/notifications'
import { ConfirmOrderPaymentCommand } from './confirm-order-payment.command'

@CommandHandler(ConfirmOrderPaymentCommand)
export class ConfirmOrderPaymentHandler implements ICommandHandler<ConfirmOrderPaymentCommand> {
  constructor(
    @Inject(ORDER_WRITE_REPOSITORY) private readonly writeRepo: IOrderWriteRepository,
    @Inject(ORDER_READ_REPOSITORY) private readonly readRepo: IOrderReadRepository,
    private readonly commandBus: CommandBus,
    private readonly notifications: NotificationsService,
  ) {}

  async execute(command: ConfirmOrderPaymentCommand): Promise<OrderPaymentConfirmedProjection> {
    // 1. Find order
    const order = await this.readRepo.findById(command.orderId)
    if (!order) throw AppException.notFound('entities.order', command.orderId)

    // 2. Confirm payment (pending → paid)
    order.confirmPayment(command.audit.userId)

    // 3. Generate delivery link
    const deliveryResult = await this.commandBus.execute<
      CreateDeliveryLinkCommand,
      DeliveryLinkCreatedProjection
    >(new CreateDeliveryLinkCommand(order.id))

    // 4. Mark as delivered (paid → delivered)
    order.markDelivered()

    // 5. Save order
    await this.writeRepo.save(order)

    // 6. Get order detail for notification
    const detail = await this.readRepo.getDetail(order.id)

    // 7. Emit notification
    this.notifications.emitOrderPaid({
      orderId: order.id,
      eventName: detail?.eventName ?? '',
      customerName: detail?.customer
        ? `${detail.customer.firstName} ${detail.customer.lastName}`
        : '',
      confirmedBy: command.audit.userId,
      paidAt: order.paidAt!,
    })

    // 8. Build WhatsApp template
    const photoCount = detail?.photos.length ?? 0
    const customerFirstName = detail?.customer?.firstName ?? ''
    const whatsappTemplate = `¡Hola ${customerFirstName}! ✅ Tu pago fue confirmado. Aquí tienes tus ${photoCount} fotos en alta calidad: ${deliveryResult.deliveryUrl}. El link estará disponible por 7 días. ¡Gracias por tu compra! 🎉`

    return {
      orderId: order.id,
      deliveryUrl: deliveryResult.deliveryUrl,
      whatsappTemplate,
    }
  }
}
