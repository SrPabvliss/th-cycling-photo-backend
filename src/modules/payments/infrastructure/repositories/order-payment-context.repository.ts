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
        event_id: true,
        status: true,
        subtotal: true,
        user_id: true,
        event: { select: { tenant_id: true } },
      },
    })

    return records.map((record) => ({
      orderId: record.id,
      eventId: record.event_id,
      status: record.status,
      subtotalDollars: record.subtotal === null ? null : Number(record.subtotal),
      sellerTenantId: record.event.tenant_id,
      buyerUserId: record.user_id,
    }))
  }
}
