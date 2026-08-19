import { BullModule } from '@nestjs/bullmq'
import { forwardRef, Module } from '@nestjs/common'
import { CqrsModule } from '@nestjs/cqrs'
import { OrdersModule } from '@orders/orders.module'
import {
  ConfigurePaymentAccountHandler,
  ConfirmPaymentTransactionHandler,
  CreatePaymentIntentHandler,
} from '@payments/application/commands'
import {
  GetPaymentAccountHandler,
  GetPaymentTransactionHandler,
} from '@payments/application/queries'
import { PaymentConfirmationScheduler } from '@payments/application/services/payment-confirmation-scheduler.service'
import { SellerAccountSuspension } from '@payments/application/services/seller-account-suspension.service'
import {
  ORDER_PAYMENT_CONTEXT_REPOSITORY,
  PAYMENT_TRANSACTION_READ_REPOSITORY,
  PAYMENT_TRANSACTION_WRITE_REPOSITORY,
  SELLER_PAYMENT_ACCOUNT_READ_REPOSITORY,
  SELLER_PAYMENT_ACCOUNT_WRITE_REPOSITORY,
} from '@payments/domain/ports'
import { PaymentAmountCalculator } from '@payments/domain/services/payment-amount-calculator.service'
import { ConfirmPaymentProcessor } from '@payments/infrastructure/processors/confirm-payment.processor'
import { OrderPaymentContextRepository } from '@payments/infrastructure/repositories/order-payment-context.repository'
import { PaymentTransactionReadRepository } from '@payments/infrastructure/repositories/payment-transaction-read.repository'
import { PaymentTransactionWriteRepository } from '@payments/infrastructure/repositories/payment-transaction-write.repository'
import { SellerPaymentAccountReadRepository } from '@payments/infrastructure/repositories/seller-payment-account-read.repository'
import { SellerPaymentAccountWriteRepository } from '@payments/infrastructure/repositories/seller-payment-account-write.repository'
import { PaymentAccountsController } from '@payments/presentation/controllers/payment-accounts.controller'
import { PaymentsController } from '@payments/presentation/controllers/payments.controller'

@Module({
  imports: [
    CqrsModule,
    forwardRef(() => OrdersModule),
    BullModule.registerQueue({ name: 'payment-confirmation' }),
  ],
  controllers: [PaymentAccountsController, PaymentsController],
  providers: [
    PaymentAmountCalculator,
    ConfigurePaymentAccountHandler,
    GetPaymentAccountHandler,
    GetPaymentTransactionHandler,
    CreatePaymentIntentHandler,
    ConfirmPaymentTransactionHandler,
    PaymentConfirmationScheduler,
    SellerAccountSuspension,
    ConfirmPaymentProcessor,
    {
      provide: SELLER_PAYMENT_ACCOUNT_READ_REPOSITORY,
      useClass: SellerPaymentAccountReadRepository,
    },
    {
      provide: SELLER_PAYMENT_ACCOUNT_WRITE_REPOSITORY,
      useClass: SellerPaymentAccountWriteRepository,
    },
    { provide: PAYMENT_TRANSACTION_READ_REPOSITORY, useClass: PaymentTransactionReadRepository },
    { provide: PAYMENT_TRANSACTION_WRITE_REPOSITORY, useClass: PaymentTransactionWriteRepository },
    { provide: ORDER_PAYMENT_CONTEXT_REPOSITORY, useClass: OrderPaymentContextRepository },
  ],
  exports: [SELLER_PAYMENT_ACCOUNT_READ_REPOSITORY, PAYMENT_TRANSACTION_WRITE_REPOSITORY],
})
export class PaymentsModule {}
