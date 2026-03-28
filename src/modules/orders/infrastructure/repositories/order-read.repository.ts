import type { Prisma } from '@generated/prisma/client'
import { Injectable } from '@nestjs/common'
import type { OrderDetailProjection, OrderListProjection } from '@orders/application/projections'
import type { Order } from '@orders/domain/entities'
import type { IOrderReadRepository, OrderListFilters } from '@orders/domain/ports'
import { PaginatedResult, type Pagination } from '@shared/application'
import { PrismaService } from '@shared/infrastructure'
import * as OrderMapper from '../mappers/order.mapper'

const ORDER_LIST_SELECT = {
  id: true,
  status: true,
  created_at: true,
  paid_at: true,
  delivered_at: true,
  customer: { select: { first_name: true, last_name: true, whatsapp: true } },
  event: { select: { name: true } },
  _count: { select: { photos: true } },
  delivery_link: { select: { id: true } },
} as const

@Injectable()
export class OrderReadRepository implements IOrderReadRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Finds an order entity by ID. */
  async findById(id: string): Promise<Order | null> {
    const record = await this.prisma.order.findFirst({ where: { id } })
    return record ? OrderMapper.toEntity(record) : null
  }

  /** Retrieves a paginated list of orders with filters. */
  async getList(
    pagination: Pagination,
    filters: OrderListFilters,
  ): Promise<PaginatedResult<OrderListProjection>> {
    const where: Prisma.OrderWhereInput = {}

    if (filters.eventId) where.event_id = filters.eventId
    if (filters.status) where.status = filters.status as Prisma.EnumOrderStatusFilter
    if (filters.search) {
      where.customer = {
        OR: [
          { first_name: { contains: filters.search, mode: 'insensitive' } },
          { last_name: { contains: filters.search, mode: 'insensitive' } },
          { whatsapp: { contains: filters.search, mode: 'insensitive' } },
        ],
      }
    }

    const [orders, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        select: ORDER_LIST_SELECT,
        orderBy: { created_at: 'desc' },
        skip: pagination.skip,
        take: pagination.take,
      }),
      this.prisma.order.count({ where }),
    ])

    return new PaginatedResult(
      orders.map((o) => ({
        id: o.id,
        status: o.status,
        createdAt: o.created_at,
        paidAt: o.paid_at,
        deliveredAt: o.delivered_at,
        customerName: `${o.customer.first_name} ${o.customer.last_name}`,
        customerWhatsapp: o.customer.whatsapp,
        eventName: o.event.name,
        photoCount: o._count.photos,
        hasDeliveryLink: o.delivery_link !== null,
      })),
      total,
      pagination,
    )
  }

  /** Retrieves order detail with customer, photos, and delivery link. */
  async getDetail(id: string): Promise<OrderDetailProjection | null> {
    const record = await this.prisma.order.findFirst({
      where: { id },
      select: {
        id: true,
        status: true,
        notes: true,
        created_at: true,
        paid_at: true,
        delivered_at: true,
        cancelled_at: true,
        customer: {
          select: { id: true, first_name: true, last_name: true, whatsapp: true, email: true },
        },
        event: { select: { name: true } },
        preview_link: { select: { token: true } },
        photos: { select: { photo: { select: { id: true, filename: true, storage_key: true } } } },
        delivery_link: {
          select: { token: true, status: true, expires_at: true, download_count: true },
        },
      },
    })

    if (!record) return null

    return {
      id: record.id,
      status: record.status,
      notes: record.notes,
      createdAt: record.created_at,
      paidAt: record.paid_at,
      deliveredAt: record.delivered_at,
      cancelledAt: record.cancelled_at,
      customer: {
        id: record.customer.id,
        firstName: record.customer.first_name,
        lastName: record.customer.last_name,
        whatsapp: record.customer.whatsapp,
        email: record.customer.email,
      },
      eventName: record.event.name,
      previewLinkToken: record.preview_link.token,
      photos: record.photos.map((op) => ({
        id: op.photo.id,
        filename: op.photo.filename,
        storageKey: op.photo.storage_key,
      })),
      deliveryLink: record.delivery_link
        ? {
            token: record.delivery_link.token,
            status: record.delivery_link.status,
            expiresAt: record.delivery_link.expires_at,
            downloadCount: record.delivery_link.download_count,
          }
        : null,
    }
  }

  /** Counts orders grouped by status. */
  async countByStatus(): Promise<Record<string, number>> {
    const groups = await this.prisma.order.groupBy({
      by: ['status'],
      _count: { id: true },
    })
    return Object.fromEntries(groups.map((g) => [g.status, g._count.id]))
  }

  /** Checks if an order already exists for a preview link. */
  async existsByPreviewLinkId(previewLinkId: string): Promise<boolean> {
    const count = await this.prisma.order.count({
      where: { preview_link_id: previewLinkId },
    })
    return count > 0
  }

  /** Gets photo IDs associated with a preview link. */
  async getPreviewPhotoIds(previewLinkId: string): Promise<string[]> {
    const photos = await this.prisma.previewLinkPhoto.findMany({
      where: { preview_link_id: previewLinkId },
      select: { photo_id: true },
    })
    return photos.map((p) => p.photo_id)
  }
}
