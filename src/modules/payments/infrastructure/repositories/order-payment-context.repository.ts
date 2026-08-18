import { Injectable } from '@nestjs/common'
import type { IOrderPaymentContextRepository, OrderPaymentContext } from '@payments/domain/ports'
import { PrismaService } from '@shared/infrastructure'

@Injectable()
export class OrderPaymentContextRepository implements IOrderPaymentContextRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByOrderIds(orderIds: string[]): Promise<OrderPaymentContext[]> {
    const records = await this.prisma.order.findMany({
      where: { id: { in: orderIds } },
      select: {
        id: true,
        status: true,
        subtotal: true,
        user_id: true,
        event: { select: { created_by_id: true } },
      },
    })

    return records.map((record) => ({
      orderId: record.id,
      status: record.status,
      subtotalDollars: record.subtotal === null ? null : Number(record.subtotal),
      sellerUserId: record.event.created_by_id,
      buyerUserId: record.user_id,
    }))
  }
}
