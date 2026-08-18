import type { PaymentTransaction } from '../entities'

export interface IPaymentTransactionReadRepository {
  findByClientTransactionId(clientTransactionId: string): Promise<PaymentTransaction | null>
  findActiveByOrderId(orderId: string): Promise<PaymentTransaction | null>
}

export const PAYMENT_TRANSACTION_READ_REPOSITORY = Symbol('PAYMENT_TRANSACTION_READ_REPOSITORY')
