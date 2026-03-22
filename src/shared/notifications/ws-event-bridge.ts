import { Injectable, Logger } from '@nestjs/common'
import { OnEvent } from '@nestjs/event-emitter'
import {
  NotificationEvent,
  type OrderCreatedPayload,
  type OrderPaidPayload,
  type PreviewViewedPayload,
} from './events'
import { NotificationsGateway } from './notifications.gateway'

@Injectable()
export class WsEventBridge {
  private readonly logger = new Logger(WsEventBridge.name)

  constructor(private readonly gateway: NotificationsGateway) {}

  @OnEvent(NotificationEvent.PREVIEW_VIEWED, { async: true })
  handlePreviewViewed(payload: PreviewViewedPayload): void {
    this.logger.debug(`Emitting preview:viewed for ${payload.previewLinkId}`)
    this.gateway.emitToAll('preview:viewed', payload)
  }

  @OnEvent(NotificationEvent.ORDER_CREATED, { async: true })
  handleOrderCreated(payload: OrderCreatedPayload): void {
    this.logger.debug(`Emitting order:created for ${payload.orderId}`)
    this.gateway.emitToAll('order:created', payload)
  }

  @OnEvent(NotificationEvent.ORDER_PAID, { async: true })
  handleOrderPaid(payload: OrderPaidPayload): void {
    this.logger.debug(`Emitting order:paid for ${payload.orderId}`)
    this.gateway.emitToAll('order:paid', payload)
  }
}
