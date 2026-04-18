import type { DeliveryDataRaw } from '@deliveries/application/projections'
import type { DeliveryLink } from '@deliveries/domain/entities'
import type { IDeliveryLinkReadRepository } from '@deliveries/domain/ports'
import { Injectable } from '@nestjs/common'
import { PrismaService } from '@shared/infrastructure'
import * as DeliveryLinkMapper from '../mappers/delivery-link.mapper'

@Injectable()
export class DeliveryLinkReadRepository implements IDeliveryLinkReadRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Finds a delivery link entity by token. */
  async findByToken(token: string): Promise<DeliveryLink | null> {
    const record = await this.prisma.deliveryLink.findFirst({
      where: { token },
    })
    return record ? DeliveryLinkMapper.toEntity(record) : null
  }

  /** Retrieves delivery data with order photos for the public delivery page. */
  async getDeliveryData(token: string): Promise<DeliveryDataRaw | null> {
    const record = await this.prisma.deliveryLink.findFirst({
      where: { token },
      select: {
        token: true,
        status: true,
        expires_at: true,
        download_count: true,
        order: {
          select: {
            event: { select: { name: true } },
            snap_first_name: true,
            snap_last_name: true,
            items: {
              select: {
                photo: {
                  select: {
                    id: true,
                    filename: true,
                    storage_key: true,
                    file_size: true,
                    retouched_storage_key: true,
                    retouched_file_size: true,
                  },
                },
              },
            },
          },
        },
      },
    })

    if (!record) return null

    return {
      token: record.token,
      eventName: record.order.event.name,
      customerName:
        `${record.order.snap_first_name ?? ''} ${record.order.snap_last_name ?? ''}`.trim(),
      status: record.status,
      expiresAt: record.expires_at,
      downloadCount: record.download_count,
      photos: record.order.items.map((oi) => ({
        id: oi.photo.id,
        filename: oi.photo.filename,
        storageKey: oi.photo.retouched_storage_key ?? oi.photo.storage_key,
        fileSize: Number(
          oi.photo.retouched_storage_key
            ? (oi.photo.retouched_file_size ?? oi.photo.file_size)
            : oi.photo.file_size,
        ),
      })),
    }
  }
}
