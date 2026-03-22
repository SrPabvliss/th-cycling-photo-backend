import { Injectable } from '@nestjs/common'
import { EventEmitter2 } from '@nestjs/event-emitter'
import {
  NotificationEvent,
  type OrderCreatedPayload,
  type OrderPaidPayload,
  type PreviewViewedPayload,
} from './events'

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
}
