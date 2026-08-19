import type { Prisma } from '@generated/prisma/client'
import type { PaymentTransaction } from '../entities'

export interface IPaymentTransactionWriteRepository {
  save(transaction: PaymentTransaction): Promise<PaymentTransaction>
  runLocked<T>(
    clientTransactionId: string,
    work: (transaction: PaymentTransaction) => Promise<T>,
  ): Promise<T>
  expireOpenByOrderId(orderId: string, tx?: Prisma.TransactionClient): Promise<void>
}

export const PAYMENT_TRANSACTION_WRITE_REPOSITORY = Symbol('PAYMENT_TRANSACTION_WRITE_REPOSITORY')
