import { AuthModule } from '@auth/auth.module'
import { DeliveriesModule } from '@deliveries/deliveries.module'
import { EventsModule } from '@events/events.module'
import { MailModule } from '@mail/mail.module'
import { forwardRef, Module } from '@nestjs/common'
import { CqrsModule } from '@nestjs/cqrs'
import { CancelMyOrderHandler } from '@orders/application/commands/cancel-my-order/cancel-my-order.handler'
import { CancelOrderHandler } from '@orders/application/commands/cancel-order/cancel-order.handler'
import { ChoosePaymentMethodHandler } from '@orders/application/commands/choose-payment-method/choose-payment-method.handler'
import { ConfirmOrderPaymentHandler } from '@orders/application/commands/confirm-order-payment/confirm-order-payment.handler'
import { ConvertOrderToGiftHandler } from '@orders/application/commands/convert-order-to-gift/convert-order-to-gift.handler'
import { ConvertOrderToSaleHandler } from '@orders/application/commands/convert-order-to-sale/convert-order-to-sale.handler'
import { CreateOrderFromGalleryHandler } from '@orders/application/commands/create-order-from-gallery/create-order-from-gallery.handler'
import { CreateOrderFromPreviewHandler } from '@orders/application/commands/create-order-from-preview/create-order-from-preview.handler'
import { GiftOrderHandler } from '@orders/application/commands/gift-order/gift-order.handler'
import { NotifyPaymentInfoHandler } from '@orders/application/commands/notify-payment-info/notify-payment-info.handler'
import { RegenerateDeliveryHandler } from '@orders/application/commands/regenerate-delivery/regenerate-delivery.handler'
import { SendDeliveryHandler } from '@orders/application/commands/send-delivery/send-delivery.handler'
import { GetMyOrderDetailHandler } from '@orders/application/queries/get-my-order-detail/get-my-order-detail.handler'
import { GetMyOrderDownloadsHandler } from '@orders/application/queries/get-my-order-downloads/get-my-order-downloads.handler'
import { GetMyOrdersListHandler } from '@orders/application/queries/get-my-orders-list/get-my-orders-list.handler'
import { GetMyOrdersSummaryHandler } from '@orders/application/queries/get-my-orders-summary/get-my-orders-summary.handler'
import { GetOrderDetailHandler } from '@orders/application/queries/get-order-detail/get-order-detail.handler'
import { GetOrdersListHandler } from '@orders/application/queries/get-orders-list/get-orders-list.handler'
import { GetOrdersStatsHandler } from '@orders/application/queries/get-orders-stats/get-orders-stats.handler'
import { ORDER_READ_REPOSITORY, ORDER_WRITE_REPOSITORY } from '@orders/domain/ports'
import { OrderReadRepository } from '@orders/infrastructure/repositories/order-read.repository'
import { OrderWriteRepository } from '@orders/infrastructure/repositories/order-write.repository'
import { OrderAccountController } from '@orders/presentation/controllers/order-account.controller'
import { OrderCheckoutController } from '@orders/presentation/controllers/order-checkout.controller'
import { OrderGalleryController } from '@orders/presentation/controllers/order-gallery.controller'
import { OrderPublicController } from '@orders/presentation/controllers/order-public.controller'
import { OrdersController } from '@orders/presentation/controllers/orders.controller'
import { PaymentsModule } from '@payments/payments.module'
import { PhotosModule } from '@photos/photos.module'
import { PreviewsModule } from '@previews/previews.module'

const CommandHandlers = [
  CreateOrderFromPreviewHandler,
  CreateOrderFromGalleryHandler,
  ConfirmOrderPaymentHandler,
  ConvertOrderToSaleHandler,
  ConvertOrderToGiftHandler,
  GiftOrderHandler,
  NotifyPaymentInfoHandler,
  ChoosePaymentMethodHandler,
  CancelOrderHandler,
  RegenerateDeliveryHandler,
  SendDeliveryHandler,
  CancelMyOrderHandler,
]
const QueryHandlers = [
  GetOrdersListHandler,
  GetOrderDetailHandler,
  GetOrdersStatsHandler,
  GetMyOrdersListHandler,
  GetMyOrderDetailHandler,
  GetMyOrderDownloadsHandler,
  GetMyOrdersSummaryHandler,
]

@Module({
  imports: [
    CqrsModule,
    forwardRef(() => PreviewsModule),
    DeliveriesModule,
    MailModule,
    forwardRef(() => EventsModule),
    forwardRef(() => PhotosModule),
    forwardRef(() => AuthModule),
    forwardRef(() => PaymentsModule),
  ],
  controllers: [
    OrderAccountController,
    OrderCheckoutController,
    OrdersController,
    OrderPublicController,
    OrderGalleryController,
  ],
  providers: [
    ...CommandHandlers,
    ...QueryHandlers,
    { provide: ORDER_READ_REPOSITORY, useClass: OrderReadRepository },
    { provide: ORDER_WRITE_REPOSITORY, useClass: OrderWriteRepository },
  ],
  exports: [ORDER_READ_REPOSITORY, ORDER_WRITE_REPOSITORY],
})
export class OrdersModule {}
