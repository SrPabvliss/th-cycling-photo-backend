import { Injectable } from '@nestjs/common'
import type { PaymentTransaction } from '@payments/domain/entities'
import type { IPaymentTransactionReadRepository } from '@payments/domain/ports'
import { PaymentTransactionStatus } from '@payments/domain/value-objects/payment-transaction-status.vo'
import { PrismaService } from '@shared/infrastructure'
import * as PaymentTransactionMapper from '../mappers/payment-transaction.mapper'

const REUSABLE_TRANSACTION_WINDOW_MS = 8 * 60 * 1000

@Injectable()
export class PaymentTransactionReadRepository implements IPaymentTransactionReadRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByClientTransactionId(clientTransactionId: string): Promise<PaymentTransaction | null> {
    const record = await this.prisma.paymentTransaction.findUnique({
      where: { client_transaction_id: clientTransactionId },
    })
    return record ? PaymentTransactionMapper.toEntity(record) : null
  }

  async findActiveByOrderId(orderId: string): Promise<PaymentTransaction | null> {
    const record = await this.prisma.paymentTransaction.findFirst({
      where: {
        order_id: orderId,
        status: { in: [PaymentTransactionStatus.INITIATED, PaymentTransactionStatus.CONFIRMING] },
        created_at: { gte: new Date(Date.now() - REUSABLE_TRANSACTION_WINDOW_MS) },
      },
      orderBy: { created_at: 'desc' },
    })
    return record ? PaymentTransactionMapper.toEntity(record) : null
  }
}
