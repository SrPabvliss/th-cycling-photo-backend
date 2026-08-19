import type { Prisma } from '@generated/prisma/client'
import { Injectable } from '@nestjs/common'
import type { Order } from '@orders/domain/entities'
import type { IOrderWriteRepository, OrderItemInput, OrderSnapData } from '@orders/domain/ports'
import { OrderStatus } from '@orders/domain/value-objects/order-status.vo'
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

  /** Creates photo associations for an order with per-item unit price. */
  async savePhotos(orderId: string, items: OrderItemInput[]): Promise<void> {
    await this.prisma.orderItem.createMany({
      data: items.map((i) => ({
        order_id: orderId,
        photo_id: i.photoId,
        unit_price: i.unitPrice,
      })),
      skipDuplicates: true,
    })
  }

  async replaceItems(orderId: string, items: OrderItemInput[]): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.orderItem.deleteMany({ where: { order_id: orderId } })
      await tx.orderItem.createMany({
        data: items.map((i) => ({
          order_id: orderId,
          photo_id: i.photoId,
          unit_price: i.unitPrice,
        })),
      })
    })
  }

  async lockAndUpsertDraft(
    userId: string,
    eventId: string,
    build: (
      existingDraft: Order | null,
      tx: Prisma.TransactionClient,
    ) => Promise<{ order: Order; items: OrderItemInput[]; snap: OrderSnapData }>,
  ): Promise<Order> {
    return this.prisma.$transaction(async (tx) => {
      const lockKey = `${userId}:${eventId}`
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`

      const existingRecord = await tx.order.findFirst({
        where: { user_id: userId, event_id: eventId, status: OrderStatus.DRAFT },
        orderBy: { created_at: 'desc' },
      })
      const existingDraft = existingRecord ? OrderMapper.toEntity(existingRecord) : null

      const { order, items, snap } = await build(existingDraft, tx)
      const data = OrderMapper.toPersistence(order)

      const saved = await tx.order.upsert({
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

      await tx.orderItem.deleteMany({ where: { order_id: order.id } })
      await tx.orderItem.createMany({
        data: items.map((i) => ({
          order_id: order.id,
          photo_id: i.photoId,
          unit_price: i.unitPrice,
        })),
      })

      return OrderMapper.toEntity(saved)
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
