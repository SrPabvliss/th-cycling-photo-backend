import { CreateDeliveryLinkCommand } from '@deliveries/application/commands'
import type { DeliveryLinkCreatedProjection } from '@deliveries/application/projections'
import {
  DELIVERY_LINK_WRITE_REPOSITORY,
  type IDeliveryLinkWriteRepository,
} from '@deliveries/domain/ports'
import { Inject } from '@nestjs/common'
import { CommandBus, CommandHandler, type ICommandHandler } from '@nestjs/cqrs'
import type { OrderPaymentConfirmedProjection } from '@orders/application/projections'
import { type IOrderReadRepository, ORDER_READ_REPOSITORY } from '@orders/domain/ports'
import { OrderStatus } from '@orders/domain/value-objects/order-status.vo'
import { AppException } from '@shared/domain'
import { RegenerateDeliveryCommand } from './regenerate-delivery.command'

@CommandHandler(RegenerateDeliveryCommand)
export class RegenerateDeliveryHandler implements ICommandHandler<RegenerateDeliveryCommand> {
  constructor(
    @Inject(ORDER_READ_REPOSITORY) private readonly orderReadRepo: IOrderReadRepository,
    @Inject(DELIVERY_LINK_WRITE_REPOSITORY)
    private readonly deliveryWriteRepo: IDeliveryLinkWriteRepository,
    private readonly commandBus: CommandBus,
  ) {}

  async execute(command: RegenerateDeliveryCommand): Promise<OrderPaymentConfirmedProjection> {
    // 1. Find order
    const order = await this.orderReadRepo.findById(command.orderId)
    if (!order) throw AppException.notFound('entities.order', command.orderId)

    // 2. Validate status is delivered
    if (order.status !== OrderStatus.DELIVERED) {
      throw AppException.businessRule('order.not_delivered')
    }

    // 3. Invalidate existing delivery link (safe even if already expired)
    await this.deliveryWriteRepo.invalidateByOrderId(command.orderId)

    // 4. Create new delivery link
    const deliveryResult = await this.commandBus.execute<
      CreateDeliveryLinkCommand,
      DeliveryLinkCreatedProjection
    >(new CreateDeliveryLinkCommand(order.id))

    // 5. Build WhatsApp template
    const detail = await this.orderReadRepo.getDetail(order.id)
    const photoCount = detail?.photos.length ?? 0
    const customerFirstName = detail?.snapFirstName ?? ''
    const whatsappTemplate = `¡Hola ${customerFirstName}! 🔄 Te enviamos un nuevo enlace de descarga para tus ${photoCount} fotos: ${deliveryResult.deliveryUrl}. Estará disponible por 7 días. ¡Gracias! 🎉`

    return {
      orderId: order.id,
      deliveryUrl: deliveryResult.deliveryUrl,
      whatsappTemplate,
    }
  }
}
