import { AuthModule } from '@auth/auth.module'
import { BillingModule } from '@billing/billing.module'
import { DeliveriesModule } from '@deliveries/deliveries.module'
import { EventsModule } from '@events/events.module'
import { MailModule } from '@mail/mail.module'
import { BullModule } from '@nestjs/bullmq'
import { forwardRef, Module } from '@nestjs/common'
import { CqrsModule } from '@nestjs/cqrs'
import { CancelMyOrderHandler } from '@orders/application/commands/cancel-my-order/cancel-my-order.handler'
import { CancelOrderHandler } from '@orders/application/commands/cancel-order/cancel-order.handler'
import { ChoosePaymentMethodHandler } from '@orders/application/commands/choose-payment-method/choose-payment-method.handler'
import { ConfirmOrderPaymentHandler } from '@orders/application/commands/confirm-order-payment/confirm-order-payment.handler'
import { ConvertOrderToGiftHandler } from '@orders/application/commands/convert-order-to-gift/convert-order-to-gift.handler'
import { ConvertOrderToSaleHandler } from '@orders/application/commands/convert-order-to-sale/convert-order-to-sale.handler'
import { CorrectMyOrderBillingHandler } from '@orders/application/commands/correct-my-order-billing/correct-my-order-billing.handler'
import { CorrectOrderBillingHandler } from '@orders/application/commands/correct-order-billing/correct-order-billing.handler'
import { CreateOrderFromPreviewHandler } from '@orders/application/commands/create-order-from-preview/create-order-from-preview.handler'
import { GiftOrderHandler } from '@orders/application/commands/gift-order/gift-order.handler'
import { NotifyPaymentInfoHandler } from '@orders/application/commands/notify-payment-info/notify-payment-info.handler'
import { RegenerateDeliveryHandler } from '@orders/application/commands/regenerate-delivery/regenerate-delivery.handler'
import { ResendOrderTaxDocumentHandler } from '@orders/application/commands/resend-order-tax-document/resend-order-tax-document.handler'
import { RetryOrderAnnulmentHandler } from '@orders/application/commands/retry-order-annulment/retry-order-annulment.handler'
import { SendDeliveryHandler } from '@orders/application/commands/send-delivery/send-delivery.handler'
import { GetMyOrderDetailHandler } from '@orders/application/queries/get-my-order-detail/get-my-order-detail.handler'
import { GetMyOrderDownloadsHandler } from '@orders/application/queries/get-my-order-downloads/get-my-order-downloads.handler'
import { GetMyOrdersListHandler } from '@orders/application/queries/get-my-orders-list/get-my-orders-list.handler'
import { GetMyOrdersSummaryHandler } from '@orders/application/queries/get-my-orders-summary/get-my-orders-summary.handler'
import { GetOrderDetailHandler } from '@orders/application/queries/get-order-detail/get-order-detail.handler'
import { GetOrderTaxDocumentFilesHandler } from '@orders/application/queries/get-order-tax-document-files/get-order-tax-document-files.handler'
import { GetOrdersListHandler } from '@orders/application/queries/get-orders-list/get-orders-list.handler'
import { GetOrdersStatsHandler } from '@orders/application/queries/get-orders-stats/get-orders-stats.handler'
import { BuyerPurchaseSnapshotService } from '@orders/application/services/buyer-purchase-snapshot.service'
import { ORDER_READ_REPOSITORY, ORDER_WRITE_REPOSITORY } from '@orders/domain/ports'
import {
  ORDER_INVOICE_SYNC_QUEUE,
  OrderInvoiceSyncProcessor,
} from '@orders/infrastructure/processors/order-invoice-sync.processor'
import { OrderReadRepository } from '@orders/infrastructure/repositories/order-read.repository'
import { OrderWriteRepository } from '@orders/infrastructure/repositories/order-write.repository'
import { OrderInvoiceSyncService } from '@orders/infrastructure/services/order-invoice-sync.service'
import { OrderInvoiceSyncSchedulerService } from '@orders/infrastructure/services/order-invoice-sync-scheduler.service'
import { OrderAccountController } from '@orders/presentation/controllers/order-account.controller'
import { OrderCheckoutController } from '@orders/presentation/controllers/order-checkout.controller'
import { OrderPublicController } from '@orders/presentation/controllers/order-public.controller'
import { OrdersController } from '@orders/presentation/controllers/orders.controller'
import { PaymentsModule } from '@payments/payments.module'
import { PhotosModule } from '@photos/photos.module'
import { PreviewsModule } from '@previews/previews.module'

const CommandHandlers = [
  CreateOrderFromPreviewHandler,
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
  ResendOrderTaxDocumentHandler,
  CorrectOrderBillingHandler,
  CorrectMyOrderBillingHandler,
  RetryOrderAnnulmentHandler,
]
const QueryHandlers = [
  GetOrdersListHandler,
  GetOrderDetailHandler,
  GetOrderTaxDocumentFilesHandler,
  GetOrdersStatsHandler,
  GetMyOrdersListHandler,
  GetMyOrderDetailHandler,
  GetMyOrderDownloadsHandler,
  GetMyOrdersSummaryHandler,
]

@Module({
  imports: [
    CqrsModule,
    BullModule.registerQueue({ name: ORDER_INVOICE_SYNC_QUEUE }),
    forwardRef(() => PreviewsModule),
    DeliveriesModule,
    MailModule,
    forwardRef(() => EventsModule),
    forwardRef(() => PhotosModule),
    forwardRef(() => AuthModule),
    forwardRef(() => PaymentsModule),
    BillingModule,
  ],
  controllers: [
    OrderAccountController,
    OrderCheckoutController,
    OrdersController,
    OrderPublicController,
  ],
  providers: [
    BuyerPurchaseSnapshotService,
    ...CommandHandlers,
    ...QueryHandlers,
    { provide: ORDER_READ_REPOSITORY, useClass: OrderReadRepository },
    { provide: ORDER_WRITE_REPOSITORY, useClass: OrderWriteRepository },
    OrderInvoiceSyncService,
    OrderInvoiceSyncProcessor,
    OrderInvoiceSyncSchedulerService,
  ],
  exports: [ORDER_READ_REPOSITORY, ORDER_WRITE_REPOSITORY, BuyerPurchaseSnapshotService],
})
export class OrdersModule {}
