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
    // Invalidate any existing delivery link for this order
    await this.writeRepo.invalidateByOrderId(command.orderId)

    // Create new delivery link
    const deliveryLink = DeliveryLink.create({
      orderId: command.orderId,
      expiresInDays: command.expiresInDays,
    })

    const saved = await this.writeRepo.save(deliveryLink)

    return {
      id: saved.id,
      token: saved.token,
      deliveryUrl: `${this.deliveryBaseUrl}/${saved.token}`,
    }
  }
}
