import { Inject } from '@nestjs/common'
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs'
import type { PaymentTransactionProjection } from '@payments/application/projections'
import {
  type IOrderPaymentContextRepository,
  type IPaymentTransactionReadRepository,
  ORDER_PAYMENT_CONTEXT_REPOSITORY,
  PAYMENT_TRANSACTION_READ_REPOSITORY,
} from '@payments/domain/ports'
import { AppException } from '@shared/domain'
import { GetPaymentTransactionQuery } from './get-payment-transaction.query'

@QueryHandler(GetPaymentTransactionQuery)
export class GetPaymentTransactionHandler implements IQueryHandler<GetPaymentTransactionQuery> {
  constructor(
    @Inject(PAYMENT_TRANSACTION_READ_REPOSITORY)
    private readonly readRepo: IPaymentTransactionReadRepository,
    @Inject(ORDER_PAYMENT_CONTEXT_REPOSITORY)
    private readonly contextRepo: IOrderPaymentContextRepository,
  ) {}

  async execute(query: GetPaymentTransactionQuery): Promise<PaymentTransactionProjection> {
    const transaction = await this.readRepo.findByClientTransactionId(query.clientTransactionId)
    if (!transaction) throw AppException.businessRule('payment.transaction_not_found')

    const contexts = await this.contextRepo.findByOrderIds(transaction.orderIds)
    if (contexts.length !== transaction.orderIds.length) {
      throw AppException.businessRule('payment.order_context_missing')
    }
    if (contexts.some((context) => context.buyerUserId !== query.buyerUserId)) {
      throw AppException.forbidden('payment.order_not_yours')
    }

    return {
      clientTransactionId: transaction.clientTransactionId,
      status: transaction.status,
      amountCents: transaction.amountCents,
      orderIds: transaction.orderIds,
      failureMessage: transaction.failureMessage,
    }
  }
}
