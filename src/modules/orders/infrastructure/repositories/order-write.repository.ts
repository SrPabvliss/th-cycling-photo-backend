import type { Prisma } from '@generated/prisma/client'
import { Injectable } from '@nestjs/common'
import type { Order } from '@orders/domain/entities'
import type { OrderPayments } from '@orders/domain/payment-hold'
import type { IOrderWriteRepository, OrderItemInput, OrderSnapData } from '@orders/domain/ports'
import { OrderStatus } from '@orders/domain/value-objects/order-status.vo'
import { PrismaService } from '@shared/infrastructure'
import * as OrderMapper from '../mappers/order.mapper'
import { livePreviewOrderWhere } from './live-preview-order'

@Injectable()
export class OrderWriteRepository implements IOrderWriteRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Persists an order entity (create or update). */
  async save(order: Order, tx?: Prisma.TransactionClient): Promise<Order> {
    const data = OrderMapper.toPersistence(order)
    const client = tx ?? this.prisma

    const saved = await client.order.upsert({
      where: { id: order.id },
      create: data,
      update: data,
    })

    return OrderMapper.toEntity(saved)
  }

  async findByIdForUpdate(id: string, tx: Prisma.TransactionClient): Promise<Order | null> {
    await tx.$queryRaw`SELECT id FROM orders WHERE id = ${id}::uuid FOR UPDATE`
    const row = await tx.order.findUnique({ where: { id } })
    return row ? OrderMapper.toEntity(row) : null
  }

  async findPaymentsForUpdate(
    orderId: string,
    tx: Prisma.TransactionClient,
  ): Promise<OrderPayments> {
    try {
      // In id order, so runs locking the same payments never wait on each other in a cycle.
      const rows = await tx.$queryRaw<{ status: string }[]>`
        SELECT pt.status::text AS status
        FROM payment_transactions pt
        JOIN payment_transaction_orders pto ON pto.payment_transaction_id = pt.id
        WHERE pto.order_id = ${orderId}::uuid
        ORDER BY pt.id
        FOR UPDATE OF pt NOWAIT
      `
      return { statuses: rows.map((row) => row.status), beingConfirmed: false }
    } catch (error) {
      if (isLockNotAvailable(error)) return { statuses: [], beingConfirmed: true }
      throw error
    }
  }

  /** Persists an order entity with snap fields in a single operation. */
  async saveWithSnap(order: Order, snap: OrderSnapData): Promise<Order> {
    const data = OrderMapper.toPersistence(order)

    const saved = await this.prisma.order.upsert({
      where: { id: order.id },
      create: {
        ...data,
        ...OrderWriteRepository.snapColumns(snap),
      },
      update: {
        ...data,
        ...OrderWriteRepository.snapColumns(snap),
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
        where: {
          user_id: userId,
          event_id: eventId,
          status: OrderStatus.DRAFT,
          preview_link_id: null,
        },
        orderBy: { created_at: 'desc' },
      })
      const existingDraft = existingRecord ? OrderMapper.toEntity(existingRecord) : null

      return OrderWriteRepository.persistBuilt(tx, await build(existingDraft, tx))
    })
  }

  /**
   * Same as `lockAndUpsertDraft`, keyed by preview link: `build` receives the order already placed
   * through this link, if any, and decides whether it may be rewritten.
   */
  async lockAndUpsertPreviewOrder(
    previewLinkId: string,
    build: (
      existing: Order | null,
      tx: Prisma.TransactionClient,
      existingIsAlive: boolean,
    ) => Promise<{ order: Order; items: OrderItemInput[]; snap: OrderSnapData }>,
  ): Promise<Order> {
    return this.prisma.$transaction(async (tx) => {
      const lockKey = `preview:${previewLinkId}`
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`

      const existingRecord = await tx.order.findFirst({
        where: { preview_link_id: previewLinkId, status: { not: 'cancelled' } },
        orderBy: { created_at: 'desc' },
      })
      const existing = existingRecord ? OrderMapper.toEntity(existingRecord) : null
      const existingIsAlive = existingRecord
        ? (await tx.order.count({
            where: { ...livePreviewOrderWhere(previewLinkId), id: existingRecord.id },
          })) > 0
        : false

      return OrderWriteRepository.persistBuilt(tx, await build(existing, tx, existingIsAlive))
    })
  }

  private static async persistBuilt(
    tx: Prisma.TransactionClient,
    { order, items, snap }: { order: Order; items: OrderItemInput[]; snap: OrderSnapData },
  ): Promise<Order> {
    const data = OrderMapper.toPersistence(order)

    const saved = await tx.order.upsert({
      where: { id: order.id },
      create: { ...data, ...OrderWriteRepository.snapColumns(snap) },
      update: { ...data, ...OrderWriteRepository.snapColumns(snap) },
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

  private static snapColumns(snap: OrderSnapData) {
    return {
      snap_first_name: snap.snapFirstName,
      snap_last_name: snap.snapLastName,
      snap_email: snap.snapEmail,
      snap_phone: snap.snapPhone,
      snap_country_id: snap.snapCountryId,
      snap_province_id: snap.snapProvinceId,
      snap_canton_id: snap.snapCantonId,
      snap_category_name: snap.snapCategoryName,
      snap_billing_account_id: snap.snapBillingAccountId,
      snap_billing_id_type: snap.snapBillingIdType,
      snap_billing_id_number: snap.snapBillingIdNumber,
      snap_billing_legal_name: snap.snapBillingLegalName,
      snap_billing_email: snap.snapBillingEmail,
      snap_billing_address: snap.snapBillingAddress,
      snap_invoice_consent_at: snap.snapInvoiceConsentAt,
      snap_invoice_consent_ip: snap.snapInvoiceConsentIp,
    }
  }
}

/** Postgres `lock_not_available` (55P03), as Prisma's driver adapter reports a NOWAIT miss. */
function isLockNotAvailable(error: unknown): boolean {
  const cause = (error as { meta?: { driverAdapterError?: { cause?: { originalCode?: string } } } })
    ?.meta?.driverAdapterError?.cause
  return cause?.originalCode === '55P03'
}
