import { CustomersModule } from '@customers/customers.module'
import { DeliveriesModule } from '@deliveries/deliveries.module'
import { Module } from '@nestjs/common'
import { CqrsModule } from '@nestjs/cqrs'
import { CancelOrderHandler } from '@orders/application/commands/cancel-order/cancel-order.handler'
import { ConfirmOrderPaymentHandler } from '@orders/application/commands/confirm-order-payment/confirm-order-payment.handler'
import { CreateOrderFromPreviewHandler } from '@orders/application/commands/create-order-from-preview/create-order-from-preview.handler'
import { GetOrderDetailHandler } from '@orders/application/queries/get-order-detail/get-order-detail.handler'
import { GetOrdersListHandler } from '@orders/application/queries/get-orders-list/get-orders-list.handler'
import { ORDER_READ_REPOSITORY, ORDER_WRITE_REPOSITORY } from '@orders/domain/ports'
import { OrderReadRepository } from '@orders/infrastructure/repositories/order-read.repository'
import { OrderWriteRepository } from '@orders/infrastructure/repositories/order-write.repository'
import { OrderPublicController } from '@orders/presentation/controllers/order-public.controller'
import { OrdersController } from '@orders/presentation/controllers/orders.controller'
import { PreviewsModule } from '@previews/previews.module'

const CommandHandlers = [
  CreateOrderFromPreviewHandler,
  ConfirmOrderPaymentHandler,
  CancelOrderHandler,
]
const QueryHandlers = [GetOrdersListHandler, GetOrderDetailHandler]

@Module({
  imports: [CqrsModule, CustomersModule, PreviewsModule, DeliveriesModule],
  controllers: [OrdersController, OrderPublicController],
  providers: [
    ...CommandHandlers,
    ...QueryHandlers,
    { provide: ORDER_READ_REPOSITORY, useClass: OrderReadRepository },
    { provide: ORDER_WRITE_REPOSITORY, useClass: OrderWriteRepository },
  ],
  exports: [ORDER_READ_REPOSITORY, ORDER_WRITE_REPOSITORY],
})
export class OrdersModule {}
