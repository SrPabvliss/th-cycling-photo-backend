import type { DeliveryLink } from '@deliveries/domain/entities'
import type { IDeliveryLinkWriteRepository } from '@deliveries/domain/ports'
import { Injectable } from '@nestjs/common'
import { PrismaService } from '@shared/infrastructure'
import * as DeliveryLinkMapper from '../mappers/delivery-link.mapper'

@Injectable()
export class DeliveryLinkWriteRepository implements IDeliveryLinkWriteRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Persists a delivery link entity (create or update). */
  async save(deliveryLink: DeliveryLink): Promise<DeliveryLink> {
    const data = DeliveryLinkMapper.toPersistence(deliveryLink)

    const saved = await this.prisma.deliveryLink.upsert({
      where: { id: deliveryLink.id },
      create: data,
      update: data,
    })

    return DeliveryLinkMapper.toEntity(saved)
  }

  /** Invalidates (expires) any existing delivery link for an order. */
  async invalidateByOrderId(orderId: string): Promise<void> {
    await this.prisma.deliveryLink.updateMany({
      where: { order_id: orderId, status: { not: 'expired' } },
      data: { status: 'expired' },
    })
  }
}
