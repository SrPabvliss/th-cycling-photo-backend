import { AuthModule } from '@auth/auth.module'
import { DeliveriesModule } from '@deliveries/deliveries.module'
import { EventsModule } from '@events/events.module'
import { forwardRef, Module } from '@nestjs/common'
import { CqrsModule } from '@nestjs/cqrs'
import { CancelOrderHandler } from '@orders/application/commands/cancel-order/cancel-order.handler'
import { ConfirmOrderPaymentHandler } from '@orders/application/commands/confirm-order-payment/confirm-order-payment.handler'
import { CreateOrderFromGalleryHandler } from '@orders/application/commands/create-order-from-gallery/create-order-from-gallery.handler'
import { CreateOrderFromPreviewHandler } from '@orders/application/commands/create-order-from-preview/create-order-from-preview.handler'
import { RegenerateDeliveryHandler } from '@orders/application/commands/regenerate-delivery/regenerate-delivery.handler'
import { SendDeliveryHandler } from '@orders/application/commands/send-delivery/send-delivery.handler'
import { GetOrderDetailHandler } from '@orders/application/queries/get-order-detail/get-order-detail.handler'
import { GetOrdersListHandler } from '@orders/application/queries/get-orders-list/get-orders-list.handler'
import { GetOrdersStatsHandler } from '@orders/application/queries/get-orders-stats/get-orders-stats.handler'
import { ORDER_READ_REPOSITORY, ORDER_WRITE_REPOSITORY } from '@orders/domain/ports'
import { OrderReadRepository } from '@orders/infrastructure/repositories/order-read.repository'
import { OrderWriteRepository } from '@orders/infrastructure/repositories/order-write.repository'
import { OrderGalleryController } from '@orders/presentation/controllers/order-gallery.controller'
import { OrderPublicController } from '@orders/presentation/controllers/order-public.controller'
import { OrdersController } from '@orders/presentation/controllers/orders.controller'
import { PhotosModule } from '@photos/photos.module'
import { PreviewsModule } from '@previews/previews.module'

const CommandHandlers = [
  CreateOrderFromPreviewHandler,
  CreateOrderFromGalleryHandler,
  ConfirmOrderPaymentHandler,
  CancelOrderHandler,
  RegenerateDeliveryHandler,
  SendDeliveryHandler,
]
const QueryHandlers = [GetOrdersListHandler, GetOrderDetailHandler, GetOrdersStatsHandler]

@Module({
  imports: [
    CqrsModule,
    forwardRef(() => PreviewsModule),
    DeliveriesModule,
    forwardRef(() => EventsModule),
    forwardRef(() => PhotosModule),
    forwardRef(() => AuthModule),
  ],
  controllers: [OrdersController, OrderPublicController, OrderGalleryController],
  providers: [
    ...CommandHandlers,
    ...QueryHandlers,
    { provide: ORDER_READ_REPOSITORY, useClass: OrderReadRepository },
    { provide: ORDER_WRITE_REPOSITORY, useClass: OrderWriteRepository },
  ],
  exports: [ORDER_READ_REPOSITORY, ORDER_WRITE_REPOSITORY],
})
export class OrdersModule {}
