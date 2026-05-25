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

  /**
   * Single atomic UPDATE that both increments the counter and enforces the cap.
   * Returns false when 0 rows matched — that means the cap was reached (the
   * status guard alone would never fail here because the caller already
   * checked expiry, so a 0-row result is unambiguous: limit exceeded).
   */
  async tryRecordAccess(id: string, maxAccesses: number): Promise<boolean> {
    const now = new Date()
    const result = await this.prisma.deliveryLink.updateMany({
      where: {
        id,
        download_count: { lt: maxAccesses },
        status: { in: ['active', 'downloaded'] },
      },
      data: {
        download_count: { increment: 1 },
        status: 'downloaded',
        last_downloaded_at: now,
        first_downloaded_at: undefined,
      },
    })
    if (result.count === 0) return false
    // Ensure first_downloaded_at is set if NULL (Prisma doesn't support
    // conditional update in updateMany; a follow-up no-op fills it).
    await this.prisma.deliveryLink.updateMany({
      where: { id, first_downloaded_at: null },
      data: { first_downloaded_at: now },
    })
    return true
  }
}
