import { Injectable } from '@nestjs/common'
import type { Order } from '@orders/domain/entities'
import type { IOrderWriteRepository, OrderSnapData } from '@orders/domain/ports'
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

  /** Persists an order entity with snap fields in a single operation. */
  async saveWithSnap(order: Order, snap: OrderSnapData): Promise<Order> {
    const data = OrderMapper.toPersistence(order)

    const saved = await this.prisma.order.upsert({
      where: { id: order.id },
      create: {
        ...data,
        snap_first_name: snap.snapFirstName,
        snap_last_name: snap.snapLastName,
        snap_email: snap.snapEmail,
        snap_phone: snap.snapPhone,
        snap_country_id: snap.snapCountryId,
        snap_province_id: snap.snapProvinceId,
        snap_canton_id: snap.snapCantonId,
        snap_category_name: snap.snapCategoryName,
      },
      update: {
        ...data,
        snap_first_name: snap.snapFirstName,
        snap_last_name: snap.snapLastName,
        snap_email: snap.snapEmail,
        snap_phone: snap.snapPhone,
        snap_country_id: snap.snapCountryId,
        snap_province_id: snap.snapProvinceId,
        snap_canton_id: snap.snapCantonId,
        snap_category_name: snap.snapCategoryName,
      },
    })

    return OrderMapper.toEntity(saved)
  }

  /** Creates photo associations for an order. */
  async savePhotos(orderId: string, photoIds: string[]): Promise<void> {
    await this.prisma.orderItem.createMany({
      data: photoIds.map((photoId) => ({
        order_id: orderId,
        photo_id: photoId,
      })),
      skipDuplicates: true,
    })
  }

  /** Sets delivered_as on each order item based on photo retouched status. */
  async updateItemsDeliveredAs(orderId: string): Promise<void> {
    const items = await this.prisma.orderItem.findMany({
      where: { order_id: orderId },
      select: { id: true, photo: { select: { retouched_storage_key: true } } },
    })

    await this.prisma.$transaction(
      items.map((item) =>
        this.prisma.orderItem.update({
          where: { id: item.id },
          data: {
            delivered_as: item.photo.retouched_storage_key ? 'retouched' : 'original',
          },
        }),
      ),
    )
  }
}
