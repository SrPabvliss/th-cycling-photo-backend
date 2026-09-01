import { CreateDeliveryLinkCommand } from '@deliveries/application/commands'
import type { DeliveryLinkCreatedProjection } from '@deliveries/application/projections'
import { Inject, Logger } from '@nestjs/common'
import { CommandBus, CommandHandler, type ICommandHandler } from '@nestjs/cqrs'
import type { OrderPaymentConfirmedProjection } from '@orders/application/projections'
import { type IOrderReadRepository, ORDER_READ_REPOSITORY } from '@orders/domain/ports'
import { buildDeliveryTemplate } from '@orders/domain/services/delivery-template'
import { OrderStatus } from '@orders/domain/value-objects/order-status.vo'
import {
  AUTHORIZATION_SERVICE,
  type IAuthorizationService,
} from '@shared/authorization/domain/ports/authorization.service.port'
import { AppException } from '@shared/domain'
import { RegenerateDeliveryCommand } from './regenerate-delivery.command'

@CommandHandler(RegenerateDeliveryCommand)
export class RegenerateDeliveryHandler implements ICommandHandler<RegenerateDeliveryCommand> {
  private readonly logger = new Logger(RegenerateDeliveryHandler.name)

  constructor(
    @Inject(ORDER_READ_REPOSITORY) private readonly orderReadRepo: IOrderReadRepository,
    @Inject(AUTHORIZATION_SERVICE) private readonly authz: IAuthorizationService,
    private readonly commandBus: CommandBus,
  ) {}

  async execute(command: RegenerateDeliveryCommand): Promise<OrderPaymentConfirmedProjection> {
    // 1. Scoped load, then assert — see Ruling 21.
    const scope = await this.authz.resolveEventScope(command.audit.userId)
    const order = await this.orderReadRepo.findByIdInScope(command.orderId, scope)
    if (!order) throw AppException.notFound('entities.order', command.orderId)
    await this.authz.assert(command.audit.userId, 'order.delivery.regenerate', order.eventId)

    // 2. Validate the order has been delivered, either as a sale or a gift
    const isDeliveredSale = order.status === OrderStatus.DELIVERED
    const isDeliveredGift = order.status === OrderStatus.GIFTED && order.deliveredAt !== null
    if (!isDeliveredSale && !isDeliveredGift) {
      throw AppException.businessRule('order.not_delivered')
    }

    // 3. Create the new delivery link. It replaces the old one in place; the
    //    order keeps exactly one link, so nothing is invalidated beforehand.
    const deliveryResult = await this.commandBus.execute<
      CreateDeliveryLinkCommand,
      DeliveryLinkCreatedProjection
    >(new CreateDeliveryLinkCommand(order.id))

    // 4. Audit log — captures who regenerated, when, for which order.
    //    Old token is not logged on purpose: leaking it to logs defeats
    //    the security purpose of regeneration.
    this.logger.log({
      event: 'delivery_link.regenerated',
      orderId: order.id,
      regeneratedBy: command.audit.userId,
      at: new Date().toISOString(),
    })

    // 5. Build WhatsApp template
    const detail = await this.orderReadRepo.getDetail(order.id, scope)
    const photoCount = detail?.photos.length ?? 0
    const customerFirstName = detail?.snapFirstName ?? ''
    const whatsappTemplate = buildDeliveryTemplate(
      { customerFirstName, photoCount, deliveryUrl: deliveryResult.deliveryUrl },
      'regenerated',
    )

    return {
      orderId: order.id,
      deliveryUrl: deliveryResult.deliveryUrl,
      token: deliveryResult.token,
      eventName: detail?.eventName ?? '',
      whatsappTemplate,
    }
  }
}
