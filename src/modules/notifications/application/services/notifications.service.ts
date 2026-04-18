import { Injectable } from '@nestjs/common'
import { EventEmitter2 } from '@nestjs/event-emitter'
import {
  NotificationEvent,
  type OrderCreatedPayload,
  type OrderDeliveredPayload,
  type OrderPaidPayload,
  type PreviewViewedPayload,
} from './notification-events'

@Injectable()
export class NotificationsService {
  constructor(private readonly eventEmitter: EventEmitter2) {}

  emitPreviewViewed(payload: PreviewViewedPayload): void {
    this.eventEmitter.emit(NotificationEvent.PREVIEW_VIEWED, payload)
  }

  emitOrderCreated(payload: OrderCreatedPayload): void {
    this.eventEmitter.emit(NotificationEvent.ORDER_CREATED, payload)
  }

  emitOrderPaid(payload: OrderPaidPayload): void {
    this.eventEmitter.emit(NotificationEvent.ORDER_PAID, payload)
  }

  emitOrderDelivered(payload: OrderDeliveredPayload): void {
    this.eventEmitter.emit(NotificationEvent.ORDER_DELIVERED, payload)
  }
}
