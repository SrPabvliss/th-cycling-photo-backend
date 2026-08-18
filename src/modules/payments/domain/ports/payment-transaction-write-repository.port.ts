import type { PaymentTransaction } from '../entities'

export interface IPaymentTransactionWriteRepository {
  save(transaction: PaymentTransaction): Promise<PaymentTransaction>
  runLocked<T>(
    clientTransactionId: string,
    work: (transaction: PaymentTransaction) => Promise<T>,
  ): Promise<T>
}

export const PAYMENT_TRANSACTION_WRITE_REPOSITORY = Symbol('PAYMENT_TRANSACTION_WRITE_REPOSITORY')
