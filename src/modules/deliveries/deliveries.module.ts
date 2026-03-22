import { CreateDeliveryLinkHandler } from '@deliveries/application/commands/create-delivery-link/create-delivery-link.handler'
import { GetDeliveryByTokenHandler } from '@deliveries/application/queries/get-delivery-by-token/get-delivery-by-token.handler'
import {
  DELIVERY_LINK_READ_REPOSITORY,
  DELIVERY_LINK_WRITE_REPOSITORY,
} from '@deliveries/domain/ports'
import { DeliveryLinkReadRepository } from '@deliveries/infrastructure/repositories/delivery-link-read.repository'
import { DeliveryLinkWriteRepository } from '@deliveries/infrastructure/repositories/delivery-link-write.repository'
import { DeliveryPublicController } from '@deliveries/presentation/controllers/delivery-public.controller'
import { Module } from '@nestjs/common'
import { CqrsModule } from '@nestjs/cqrs'

const CommandHandlers = [CreateDeliveryLinkHandler]
const QueryHandlers = [GetDeliveryByTokenHandler]

@Module({
  imports: [CqrsModule],
  controllers: [DeliveryPublicController],
  providers: [
    ...CommandHandlers,
    ...QueryHandlers,
    { provide: DELIVERY_LINK_READ_REPOSITORY, useClass: DeliveryLinkReadRepository },
    { provide: DELIVERY_LINK_WRITE_REPOSITORY, useClass: DeliveryLinkWriteRepository },
  ],
  exports: [DELIVERY_LINK_WRITE_REPOSITORY],
})
export class DeliveriesModule {}
