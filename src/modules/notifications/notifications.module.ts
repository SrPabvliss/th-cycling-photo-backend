import { Global, Module } from '@nestjs/common'
import { CqrsModule } from '@nestjs/cqrs'
import { MarkAllReadHandler } from '@notifications/application/commands/mark-all-read/mark-all-read.handler'
import { MarkAsReadHandler } from '@notifications/application/commands/mark-as-read/mark-as-read.handler'
import { GetNotificationsListHandler } from '@notifications/application/queries/get-notifications-list/get-notifications-list.handler'
import { GetUnreadCountHandler } from '@notifications/application/queries/get-unread-count/get-unread-count.handler'
import { NotificationsService } from '@notifications/application/services/notifications.service'
import {
  NOTIFICATION_READ_REPOSITORY,
  NOTIFICATION_WRITE_REPOSITORY,
} from '@notifications/domain/ports'
import { WsEventBridge } from '@notifications/infrastructure/bridge/ws-event-bridge'
import { NotificationsGateway } from '@notifications/infrastructure/gateway/notifications.gateway'
import { NotificationReadRepository } from '@notifications/infrastructure/repositories/notification-read.repository'
import { NotificationWriteRepository } from '@notifications/infrastructure/repositories/notification-write.repository'
import { NotificationsController } from '@notifications/presentation/controllers/notifications.controller'
import { AuthModule } from '../auth/auth.module'
import { UsersModule } from '../users/users.module'

const CommandHandlers = [MarkAsReadHandler, MarkAllReadHandler]
const QueryHandlers = [GetNotificationsListHandler, GetUnreadCountHandler]

@Global()
@Module({
  imports: [CqrsModule, AuthModule, UsersModule],
  controllers: [NotificationsController],
  providers: [
    ...CommandHandlers,
    ...QueryHandlers,
    NotificationsService,
    NotificationsGateway,
    WsEventBridge,
    { provide: NOTIFICATION_READ_REPOSITORY, useClass: NotificationReadRepository },
    { provide: NOTIFICATION_WRITE_REPOSITORY, useClass: NotificationWriteRepository },
  ],
  exports: [NotificationsService],
})
export class NotificationsModule {}
