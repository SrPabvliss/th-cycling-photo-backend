import { Injectable } from '@nestjs/common'
import type { PaymentTransaction } from '@payments/domain/entities'
import type { IPaymentTransactionReadRepository } from '@payments/domain/ports'
import { PrismaService } from '@shared/infrastructure'
import * as PaymentTransactionMapper from '../mappers/payment-transaction.mapper'

@Injectable()
export class PaymentTransactionReadRepository implements IPaymentTransactionReadRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByClientTransactionId(clientTransactionId: string): Promise<PaymentTransaction | null> {
    const record = await this.prisma.paymentTransaction.findUnique({
      where: { client_transaction_id: clientTransactionId },
      include: { orders: { select: { order_id: true } } },
    })
    return record ? PaymentTransactionMapper.toEntity(record) : null
  }

  async existsOtherApprovedForOrder(
    orderId: string,
    clientTransactionId: string,
  ): Promise<boolean> {
    const count = await this.prisma.paymentTransaction.count({
      where: {
        status: 'approved',
        client_transaction_id: { not: clientTransactionId },
        orders: { some: { order_id: orderId } },
      },
    })
    return count > 0
  }
}
