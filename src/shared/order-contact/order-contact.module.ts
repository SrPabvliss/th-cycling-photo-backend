import { Module } from '@nestjs/common'
import { OrderContactService } from './order-contact.service'

@Module({
  providers: [OrderContactService],
  exports: [OrderContactService],
})
export class OrderContactModule {}
