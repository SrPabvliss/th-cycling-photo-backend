import type { Prisma } from '@generated/prisma/client'
import { Inject, Injectable, Logger } from '@nestjs/common'
import { OnEvent } from '@nestjs/event-emitter'
import {
  NotificationEvent,
  type OrderCreatedPayload,
  type OrderDeliveredPayload,
  type OrderPaidPayload,
  type OrderRetouchCompletedPayload,
  type PreviewViewedPayload,
} from '@notifications/application/services/notification-events'
import {
  type INotificationWriteRepository,
  NOTIFICATION_WRITE_REPOSITORY,
} from '@notifications/domain/ports'
import { NotificationsGateway } from '@notifications/infrastructure/gateway/notifications.gateway'
import { type IUserReadRepository, USER_READ_REPOSITORY } from '@users/domain/ports'
import { NOTIFICATION_TEMPLATES } from './notification-templates'

@Injectable()
export class WsEventBridge {
  private readonly logger = new Logger(WsEventBridge.name)

  constructor(
    private readonly gateway: NotificationsGateway,
    @Inject(NOTIFICATION_WRITE_REPOSITORY)
    private readonly notificationWriteRepo: INotificationWriteRepository,
    @Inject(USER_READ_REPOSITORY)
    private readonly userReadRepo: IUserReadRepository,
  ) {}

  private async persistAndBroadcast(
    eventType: string,
    wsEvent: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    const template = NOTIFICATION_TEMPLATES[eventType]
    if (!template) {
      this.logger.warn(`No template for event type: ${eventType}`)
      return
    }

    const title = template.title
    const message = template.message(payload)

    try {
      const adminIds = await this.userReadRepo.findActiveAdminIds()
      if (adminIds.length === 0) return

      const notifications = adminIds.map((userId) => ({
        userId,
        type: eventType,
        title,
        message,
        data: payload as unknown as Record<string, Prisma.InputJsonValue>,
      }))

      const ids = await this.notificationWriteRepo.createMany(notifications)

      this.gateway.emitToAll(wsEvent, {
        id: ids[0] ?? null,
        type: eventType,
        title,
        message,
        data: payload,
        createdAt: new Date(),
      })
    } catch (error) {
      this.logger.error(`Failed to persist notification for ${eventType}`, error)
      this.gateway.emitToAll(wsEvent, {
        id: null,
        type: eventType,
        title,
        message,
        data: payload,
        createdAt: new Date(),
      })
    }
  }

  @OnEvent(NotificationEvent.PREVIEW_VIEWED, { async: true })
  async handlePreviewViewed(payload: PreviewViewedPayload): Promise<void> {
    this.logger.debug(`Processing preview:viewed for ${payload.previewLinkId}`)
    await this.persistAndBroadcast(
      NotificationEvent.PREVIEW_VIEWED,
      'preview:viewed',
      payload as unknown as Record<string, unknown>,
    )
  }

  @OnEvent(NotificationEvent.ORDER_CREATED, { async: true })
  async handleOrderCreated(payload: OrderCreatedPayload): Promise<void> {
    this.logger.debug(`Processing order:created for ${payload.orderId}`)
    await this.persistAndBroadcast(
      NotificationEvent.ORDER_CREATED,
      'order:created',
      payload as unknown as Record<string, unknown>,
    )
  }

  @OnEvent(NotificationEvent.ORDER_PAID, { async: true })
  async handleOrderPaid(payload: OrderPaidPayload): Promise<void> {
    this.logger.debug(`Processing order:paid for ${payload.orderId}`)
    await this.persistAndBroadcast(
      NotificationEvent.ORDER_PAID,
      'order:paid',
      payload as unknown as Record<string, unknown>,
    )
  }

  @OnEvent(NotificationEvent.ORDER_DELIVERED, { async: true })
  async handleOrderDelivered(payload: OrderDeliveredPayload): Promise<void> {
    this.logger.debug(`Processing order:delivered for ${payload.orderId}`)
    await this.persistAndBroadcast(
      NotificationEvent.ORDER_DELIVERED,
      'order:delivered',
      payload as unknown as Record<string, unknown>,
    )
  }

  @OnEvent(NotificationEvent.ORDER_RETOUCH_COMPLETED, { async: true })
  async handleOrderRetouchCompleted(payload: OrderRetouchCompletedPayload): Promise<void> {
    this.logger.debug(`Processing order:retouch_completed for ${payload.orderId}`)
    await this.persistAndBroadcast(
      NotificationEvent.ORDER_RETOUCH_COMPLETED,
      'order:retouch_completed',
      payload as unknown as Record<string, unknown>,
    )
  }
}
