import { CreateDeliveryLinkCommand } from '@deliveries/application/commands'
import type { DeliveryLinkCreatedProjection } from '@deliveries/application/projections'
import { Inject } from '@nestjs/common'
import { CommandBus, CommandHandler, type ICommandHandler } from '@nestjs/cqrs'
import { NotificationsService } from '@notifications/application/services/notifications.service'
import type { OrderPaymentConfirmedProjection } from '@orders/application/projections'
import {
  type IOrderReadRepository,
  type IOrderWriteRepository,
  ORDER_READ_REPOSITORY,
  ORDER_WRITE_REPOSITORY,
} from '@orders/domain/ports'
import { OrderStatus } from '@orders/domain/value-objects/order-status.vo'
import { AppException } from '@shared/domain'
import { SendDeliveryCommand } from './send-delivery.command'

@CommandHandler(SendDeliveryCommand)
export class SendDeliveryHandler implements ICommandHandler<SendDeliveryCommand> {
  constructor(
    @Inject(ORDER_WRITE_REPOSITORY) private readonly writeRepo: IOrderWriteRepository,
    @Inject(ORDER_READ_REPOSITORY) private readonly readRepo: IOrderReadRepository,
    private readonly commandBus: CommandBus,
    private readonly notifications: NotificationsService,
  ) {}

  async execute(command: SendDeliveryCommand): Promise<OrderPaymentConfirmedProjection> {
    // 1. Find order
    const order = await this.readRepo.findById(command.orderId)
    if (!order) throw AppException.notFound('entities.order', command.orderId)

    // 2. Validate status is paid
    if (order.status !== OrderStatus.PAID) {
      throw AppException.businessRule('order.not_paid')
    }

    // 3. Generate delivery link
    const deliveryResult = await this.commandBus.execute<
      CreateDeliveryLinkCommand,
      DeliveryLinkCreatedProjection
    >(new CreateDeliveryLinkCommand(order.id))

    // 4. Mark as delivered (paid → delivered)
    order.markDelivered()

    // 5. Save order
    await this.writeRepo.save(order)

    // 6. Get detail for notification + template
    const detail = await this.readRepo.getDetail(order.id)
    const photoCount = detail?.photos.length ?? 0
    const customerFirstName = detail?.customer?.firstName ?? ''
    const customerName = detail?.customer
      ? `${detail.customer.firstName} ${detail.customer.lastName}`
      : ''

    // 7. Emit notification
    this.notifications.emitOrderDelivered({
      orderId: order.id,
      eventName: detail?.eventName ?? '',
      customerName,
      deliveredAt: order.deliveredAt!,
    })

    // 8. Build WhatsApp template
    const whatsappTemplate = `¡Hola ${customerFirstName}! ✅ Tu pago fue confirmado. Aquí tienes tus ${photoCount} fotos en alta calidad: ${deliveryResult.deliveryUrl}. El link estará disponible por 7 días. ¡Gracias por tu compra! 🎉`

    return {
      orderId: order.id,
      deliveryUrl: deliveryResult.deliveryUrl,
      whatsappTemplate,
    }
  }
}
