import { Injectable } from '@nestjs/common'
import { PaymentTransaction } from '@payments/domain/entities'
import type { IPaymentTransactionWriteRepository } from '@payments/domain/ports'
import { AppException } from '@shared/domain'
import { PrismaService } from '@shared/infrastructure'
import * as PaymentTransactionMapper from '../mappers/payment-transaction.mapper'

@Injectable()
export class PaymentTransactionWriteRepository implements IPaymentTransactionWriteRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(transaction: PaymentTransaction): Promise<PaymentTransaction> {
    const data = PaymentTransactionMapper.toPersistence(transaction)

    const saved = await this.prisma.paymentTransaction.upsert({
      where: { id: transaction.id },
      create: data,
      update: data,
    })

    return PaymentTransactionMapper.toEntity(saved)
  }

  async runLocked<T>(
    clientTransactionId: string,
    work: (transaction: PaymentTransaction) => Promise<T>,
  ): Promise<T> {
    return this.prisma.$transaction(
      async (tx) => {
        const rows = await tx.$queryRaw<
          { id: string }[]
        >`SELECT id FROM payment_transactions WHERE client_transaction_id = ${clientTransactionId} FOR UPDATE`

        const lockedId = rows[0]?.id
        if (!lockedId) throw AppException.businessRule('payment.transaction_not_found')

        const record = await tx.paymentTransaction.findUniqueOrThrow({ where: { id: lockedId } })
        const entity = PaymentTransactionMapper.toEntity(record)

        const result = await work(entity)

        const data = PaymentTransactionMapper.toPersistence(entity)
        await tx.paymentTransaction.update({ where: { id: lockedId }, data })

        return result
      },
      { maxWait: 5_000, timeout: 30_000 },
    )
  }
}
