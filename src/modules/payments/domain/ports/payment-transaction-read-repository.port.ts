import type { PaymentTransaction } from '../entities'

export interface IPaymentTransactionReadRepository {
  findByClientTransactionId(clientTransactionId: string): Promise<PaymentTransaction | null>
  /** Whether a card charge other than `clientTransactionId` was approved for the order. */
  existsOtherApprovedForOrder(orderId: string, clientTransactionId: string): Promise<boolean>
}

export const PAYMENT_TRANSACTION_READ_REPOSITORY = Symbol('PAYMENT_TRANSACTION_READ_REPOSITORY')
