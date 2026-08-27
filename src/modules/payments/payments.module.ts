import { EventsModule } from '@events/events.module'
import { BullModule } from '@nestjs/bullmq'
import { forwardRef, Module } from '@nestjs/common'
import { CqrsModule } from '@nestjs/cqrs'
import { OrdersModule } from '@orders/orders.module'
import {
  ConfirmPaymentTransactionHandler,
  CreatePaymentIntentHandler,
} from '@payments/application/commands'
import { GetPaymentTransactionHandler } from '@payments/application/queries'
import { PaymentConfirmationScheduler } from '@payments/application/services/payment-confirmation-scheduler.service'
import { SellerAccountSuspension } from '@payments/application/services/seller-account-suspension.service'
import {
  ORDER_PAYMENT_CONTEXT_REPOSITORY,
  PAYMENT_TRANSACTION_READ_REPOSITORY,
  PAYMENT_TRANSACTION_WRITE_REPOSITORY,
} from '@payments/domain/ports'
import { PaymentAmountCalculator } from '@payments/domain/services/payment-amount-calculator.service'
import { ConfirmPaymentProcessor } from '@payments/infrastructure/processors/confirm-payment.processor'
import { OrderPaymentContextRepository } from '@payments/infrastructure/repositories/order-payment-context.repository'
import { PaymentTransactionReadRepository } from '@payments/infrastructure/repositories/payment-transaction-read.repository'
import { PaymentTransactionWriteRepository } from '@payments/infrastructure/repositories/payment-transaction-write.repository'
import { PaymentsController } from '@payments/presentation/controllers/payments.controller'
import { TenantsModule } from '../tenants/tenants.module'

@Module({
  imports: [
    CqrsModule,
    forwardRef(() => OrdersModule),
    forwardRef(() => EventsModule),
    BullModule.registerQueue({ name: 'payment-confirmation' }),
    TenantsModule,
  ],
  controllers: [PaymentsController],
  providers: [
    PaymentAmountCalculator,
    GetPaymentTransactionHandler,
    CreatePaymentIntentHandler,
    ConfirmPaymentTransactionHandler,
    PaymentConfirmationScheduler,
    SellerAccountSuspension,
    ConfirmPaymentProcessor,
    { provide: PAYMENT_TRANSACTION_READ_REPOSITORY, useClass: PaymentTransactionReadRepository },
    { provide: PAYMENT_TRANSACTION_WRITE_REPOSITORY, useClass: PaymentTransactionWriteRepository },
    { provide: ORDER_PAYMENT_CONTEXT_REPOSITORY, useClass: OrderPaymentContextRepository },
  ],
  exports: [PAYMENT_TRANSACTION_WRITE_REPOSITORY],
})
export class PaymentsModule {}
