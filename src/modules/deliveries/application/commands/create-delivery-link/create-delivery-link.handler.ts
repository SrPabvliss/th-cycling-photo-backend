import type { DeliveryLinkCreatedProjection } from '@deliveries/application/projections'
import { DeliveryLink } from '@deliveries/domain/entities'
import {
  DELIVERY_LINK_WRITE_REPOSITORY,
  type IDeliveryLinkWriteRepository,
} from '@deliveries/domain/ports'
import { Inject } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs'
import { CreateDeliveryLinkCommand } from './create-delivery-link.command'

@CommandHandler(CreateDeliveryLinkCommand)
export class CreateDeliveryLinkHandler implements ICommandHandler<CreateDeliveryLinkCommand> {
  private readonly deliveryBaseUrl: string

  constructor(
    @Inject(DELIVERY_LINK_WRITE_REPOSITORY)
    private readonly writeRepo: IDeliveryLinkWriteRepository,
    config: ConfigService,
  ) {
    this.deliveryBaseUrl = config.getOrThrow<string>('delivery.baseUrl')
  }

  async execute(command: CreateDeliveryLinkCommand): Promise<DeliveryLinkCreatedProjection> {
    const deliveryLink = DeliveryLink.create({
      orderId: command.orderId,
      expiresInDays: command.expiresInDays,
    })

    // Replaces the order's link rather than expiring the old one and inserting
    // a new row: order_id is unique, so the insert would fail and leave the
    // order with an expired link and no replacement.
    const saved = await this.writeRepo.replaceForOrder(deliveryLink)

    return {
      id: saved.id,
      token: saved.token,
      deliveryUrl: `${this.deliveryBaseUrl}/${saved.token}`,
      expiresAt: saved.expiresAt,
    }
  }
}
