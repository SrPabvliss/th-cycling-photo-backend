import { CreateDeliveryLinkCommand } from '@deliveries/application/commands'
import type { DeliveryLinkCreatedProjection } from '@deliveries/application/projections'
import {
  DELIVERY_LINK_READ_REPOSITORY,
  type IDeliveryLinkReadRepository,
} from '@deliveries/domain/ports'
import { MailService } from '@mail/application/services/mail.service'
import { Inject, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
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

type DeliveryOutcome = {
  token: string
  deliveryUrl: string
  expiresAt: Date | null
  reused: boolean
}

@CommandHandler(SendDeliveryCommand)
export class SendDeliveryHandler implements ICommandHandler<SendDeliveryCommand> {
  private readonly logger = new Logger(SendDeliveryHandler.name)
  private readonly webBaseUrl: string
  private readonly deliveryBaseUrl: string

  constructor(
    @Inject(ORDER_WRITE_REPOSITORY)
    private readonly writeRepo: IOrderWriteRepository,
    @Inject(ORDER_READ_REPOSITORY)
    private readonly readRepo: IOrderReadRepository,
    @Inject(DELIVERY_LINK_READ_REPOSITORY)
    private readonly deliveryReadRepo: IDeliveryLinkReadRepository,
    private readonly commandBus: CommandBus,
    private readonly notifications: NotificationsService,
    private readonly mailService: MailService,
    private readonly config: ConfigService,
  ) {
    this.webBaseUrl = this.config.getOrThrow<string>('app.webBaseUrl')
    this.deliveryBaseUrl = this.config.getOrThrow<string>('delivery.baseUrl')
  }

  async execute(command: SendDeliveryCommand): Promise<OrderPaymentConfirmedProjection> {
    // 1. Find order
    const order = await this.readRepo.findById(command.orderId)
    if (!order) throw AppException.notFound('entities.order', command.orderId)

    // 2. Validate: paid (sale) or gifted still awaiting its link
    const isSale = order.status === OrderStatus.PAID
    const isGiftPendingDelivery = order.status === OrderStatus.GIFTED && order.deliveredAt === null
    if (!isSale && !isGiftPendingDelivery) {
      throw AppException.businessRule('order.not_deliverable')
    }

    // 3. Reuse an active, unexpired delivery link for this order, or mint one
    const deliveryResult = await this.resolveDeliveryLink(order.id)

    // 4. Set delivered_as on each order item based on retouched status
    await this.writeRepo.updateItemsDeliveredAs(order.id)

    // 5. Sale → delivered; gift → set deliveredAt, keep status gifted
    if (isSale) {
      order.markDelivered()
    } else {
      order.markGiftDelivered()
    }

    // 6. Save order
    await this.writeRepo.save(order)

    // 7. Get detail for notification + template
    const detail = await this.readRepo.getDetail(order.id)
    const photoCount = detail?.photos.length ?? 0
    const customerFirstName = detail?.snapFirstName ?? ''
    const customerName = detail?.userName ?? ''

    // 8. Emit notification
    this.notifications.emitOrderDelivered({
      orderId: order.id,
      eventName: detail?.eventName ?? '',
      customerName,
      deliveredAt: order.deliveredAt!,
      actorUserId: command.audit.userId,
    })

    if (!deliveryResult.reused && deliveryResult.expiresAt) {
      this.sendDeliveryEmail({
        email: detail?.snapEmail ?? null,
        firstName: customerFirstName,
        eventName: detail?.eventName ?? '',
        photoCount,
        subtotal: isSale ? (detail?.subtotal ?? null) : null,
        currency: detail?.snapCurrency ?? null,
        deliveryUrl: deliveryResult.deliveryUrl,
        expiresAt: deliveryResult.expiresAt,
      }).catch((error) => {
        this.logger.error(
          `Delivered the order but the email dispatch rejected. orderId=${order.id} reason=${error instanceof Error ? error.message : String(error)}`,
        )
      })
    }

    // 9. Build WhatsApp template (emojis as explicit \u escapes to avoid
    //    mojibake when tooling or storage transforms the source bytes).
    const whatsappTemplate = `¡Muchas gracias ${customerFirstName}! \u{2705} Tu pago fue confirmado. Aquí tienes tus ${photoCount} fotos en alta calidad: ${deliveryResult.deliveryUrl}. El link estará disponible por 7 días. ¡Gracias por tu compra! \u{1F389}`

    return {
      orderId: order.id,
      deliveryUrl: deliveryResult.deliveryUrl,
      token: deliveryResult.token,
      eventName: detail?.eventName ?? '',
      whatsappTemplate,
    }
  }

  private async resolveDeliveryLink(orderId: string): Promise<DeliveryOutcome> {
    const activeLinks = await this.deliveryReadRepo.findActiveByOrderIds([orderId])
    const [existing] = activeLinks

    if (existing) {
      return {
        token: existing.token,
        deliveryUrl: `${this.deliveryBaseUrl}/${existing.token}`,
        expiresAt: null,
        reused: true,
      }
    }

    const deliveryResult = await this.commandBus.execute<
      CreateDeliveryLinkCommand,
      DeliveryLinkCreatedProjection
    >(new CreateDeliveryLinkCommand(orderId))

    return {
      token: deliveryResult.token,
      deliveryUrl: deliveryResult.deliveryUrl,
      expiresAt: deliveryResult.expiresAt,
      reused: false,
    }
  }

  private async sendDeliveryEmail(data: {
    email: string | null
    firstName: string
    eventName: string
    photoCount: number
    subtotal: string | null
    currency: string | null
    deliveryUrl: string
    expiresAt: Date
  }): Promise<void> {
    if (!data.email) {
      this.logger.warn(
        `Delivered an order with no email address on file. eventName=${data.eventName}`,
      )
      return
    }

    const total =
      data.subtotal === null ? '' : `${data.currency ?? 'USD'} ${Number(data.subtotal).toFixed(2)}`

    try {
      await this.mailService.enqueue({
        to: data.email,
        subject: `Tus fotos de ${data.eventName} están listas`,
        template: 'order-delivered',
        vars: {
          firstName: data.firstName || 'Hola',
          eventName: data.eventName,
          photoCount: String(data.photoCount),
          total,
          deliveryUrl: data.deliveryUrl,
          expiresOn: data.expiresAt.toLocaleDateString('es-EC', {
            day: 'numeric',
            month: 'long',
          }),
          logoUrl: `${this.webBaseUrl}/brand/logo-email.png`,
        },
      })
    } catch (error) {
      this.logger.error(
        `Delivered the order but could not enqueue its email. reason=${error instanceof Error ? error.message : String(error)}`,
      )
    }
  }
}
