import type { Prisma } from '@generated/prisma/client'
import { Injectable } from '@nestjs/common'
import { PaymentTransaction } from '@payments/domain/entities'
import type { IPaymentTransactionWriteRepository } from '@payments/domain/ports'
import { PaymentTransactionStatus } from '@payments/domain/value-objects/payment-transaction-status.vo'
import { AppException } from '@shared/domain'
import { PrismaService } from '@shared/infrastructure'
import * as PaymentTransactionMapper from '../mappers/payment-transaction.mapper'

@Injectable()
export class PaymentTransactionWriteRepository implements IPaymentTransactionWriteRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(transaction: PaymentTransaction): Promise<PaymentTransaction> {
    const data = PaymentTransactionMapper.toPersistence(transaction)

    const saved = await this.prisma.$transaction(async (tx) => {
      await tx.paymentTransaction.upsert({
        where: { id: transaction.id },
        create: data,
        update: data,
      })

      await tx.paymentTransactionOrder.createMany({
        data: transaction.orderIds.map((orderId) => ({
          payment_transaction_id: transaction.id,
          order_id: orderId,
        })),
        skipDuplicates: true,
      })

      return tx.paymentTransaction.findUniqueOrThrow({
        where: { id: transaction.id },
        include: { orders: { select: { order_id: true } } },
      })
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

        const record = await tx.paymentTransaction.findUniqueOrThrow({
          where: { id: lockedId },
          include: { orders: { select: { order_id: true } } },
        })
        const entity = PaymentTransactionMapper.toEntity(record)

        const result = await work(entity)

        const data = PaymentTransactionMapper.toPersistence(entity)
        await tx.paymentTransaction.update({ where: { id: lockedId }, data })

        return result
      },
      { maxWait: 5_000, timeout: 30_000 },
    )
  }

  async expireOpenByOrderId(orderId: string, tx?: Prisma.TransactionClient): Promise<void> {
    const client = tx ?? this.prisma
    await client.paymentTransaction.updateMany({
      where: {
        orders: { some: { order_id: orderId } },
        status: {
          in: [PaymentTransactionStatus.INITIATED, PaymentTransactionStatus.CONFIRMING],
        },
      },
      data: { status: PaymentTransactionStatus.EXPIRED, confirmed_at: new Date() },
    })
  }
}
