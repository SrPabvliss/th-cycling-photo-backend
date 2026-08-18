import { Injectable } from '@nestjs/common'
import type { IOrderPaymentContextRepository, OrderPaymentContext } from '@payments/domain/ports'
import { PrismaService } from '@shared/infrastructure'

@Injectable()
export class OrderPaymentContextRepository implements IOrderPaymentContextRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByOrderId(orderId: string): Promise<OrderPaymentContext | null> {
    const record = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        status: true,
        subtotal: true,
        user_id: true,
        event: { select: { created_by_id: true } },
      },
    })

    if (!record?.event.created_by_id) return null

    return {
      orderId: record.id,
      status: record.status,
      subtotalDollars: record.subtotal === null ? null : Number(record.subtotal),
      sellerUserId: record.event.created_by_id,
      buyerUserId: record.user_id,
    }
  }
}
