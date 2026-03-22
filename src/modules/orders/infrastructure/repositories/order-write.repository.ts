import { Injectable } from '@nestjs/common'
import type { Order } from '@orders/domain/entities'
import type { IOrderWriteRepository } from '@orders/domain/ports'
import { PrismaService } from '@shared/infrastructure'
import * as OrderMapper from '../mappers/order.mapper'

@Injectable()
export class OrderWriteRepository implements IOrderWriteRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Persists an order entity (create or update). */
  async save(order: Order): Promise<Order> {
    const data = OrderMapper.toPersistence(order)

    const saved = await this.prisma.order.upsert({
      where: { id: order.id },
      create: data,
      update: data,
    })

    return OrderMapper.toEntity(saved)
  }

  /** Creates photo associations for an order. */
  async savePhotos(orderId: string, photoIds: string[]): Promise<void> {
    await this.prisma.orderPhoto.createMany({
      data: photoIds.map((photoId) => ({
        order_id: orderId,
        photo_id: photoId,
      })),
      skipDuplicates: true,
    })
  }
}
