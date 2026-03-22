import { Global, Module } from '@nestjs/common'
import { AuthModule } from '../../modules/auth/auth.module'
import { NotificationsGateway } from './notifications.gateway'
import { NotificationsService } from './notifications.service'
import { WsEventBridge } from './ws-event-bridge'

@Global()
@Module({
  imports: [AuthModule],
  providers: [NotificationsGateway, NotificationsService, WsEventBridge],
  exports: [NotificationsService],
})
export class NotificationsModule {}
