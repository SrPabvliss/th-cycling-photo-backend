import type { Prisma } from '@generated/prisma/client'
import { Injectable } from '@nestjs/common'
import type { OrderDetailProjection, OrderListProjection } from '@orders/application/projections'
import type { Order } from '@orders/domain/entities'
import type { IOrderReadRepository, OrderListFilters } from '@orders/domain/ports'
import type { PendingRetouchOrderProjection } from '@photos/application/projections'
import { PaginatedResult, type Pagination } from '@shared/application'
import { PrismaService } from '@shared/infrastructure'
import * as OrderMapper from '../mappers/order.mapper'

const ORDER_LIST_SELECT = {
  id: true,
  status: true,
  created_at: true,
  paid_at: true,
  delivered_at: true,
  snap_first_name: true,
  snap_last_name: true,
  snap_phone: true,
  user: { select: { first_name: true, last_name: true } },
  event: { select: { name: true } },
  _count: { select: { items: true } },
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
      where.OR = [
        { snap_first_name: { contains: filters.search, mode: 'insensitive' } },
        { snap_last_name: { contains: filters.search, mode: 'insensitive' } },
        { snap_phone: { contains: filters.search, mode: 'insensitive' } },
      ]
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
        userName: [o.user.first_name, o.user.last_name].filter(Boolean).join(' '),
        snapWhatsapp: o.snap_phone,
        eventName: o.event.name,
        photoCount: o._count.items,
        hasDeliveryLink: o.delivery_link !== null,
      })),
      total,
      pagination,
    )
  }

  /** Retrieves order detail with user, photos, and delivery link. */
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
        snap_first_name: true,
        snap_last_name: true,
        snap_phone: true,
        snap_email: true,
        user: { select: { first_name: true, last_name: true } },
        event: { select: { name: true } },
        preview_link: { select: { token: true } },
        items: {
          select: {
            photo: {
              select: { id: true, filename: true, storage_key: true, retouched_storage_key: true },
            },
          },
        },
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
      userName: [record.user.first_name, record.user.last_name].filter(Boolean).join(' '),
      snapFirstName: record.snap_first_name,
      snapLastName: record.snap_last_name,
      snapWhatsapp: record.snap_phone,
      snapEmail: record.snap_email,
      eventName: record.event.name,
      previewLinkToken: record.preview_link?.token ?? null,
      retouchProgress: {
        total: record.items.length,
        retouched: record.items.filter((oi) => !!oi.photo.retouched_storage_key).length,
      },
      photos: record.items.map((oi) => ({
        id: oi.photo.id,
        filename: oi.photo.filename,
        storageKey: oi.photo.storage_key,
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

  /** Returns paid orders with at least one un-retouched photo, ordered FIFO. */
  async getPendingRetouch(cdnUrl: string | undefined): Promise<PendingRetouchOrderProjection[]> {
    const orders = await this.prisma.order.findMany({
      where: { status: 'paid' },
      orderBy: { created_at: 'asc' },
      select: {
        id: true,
        created_at: true,
        event: { select: { name: true } },
        user: { select: { first_name: true, last_name: true } },
        items: {
          select: {
            photo: {
              select: {
                id: true,
                filename: true,
                storage_key: true,
                retouched_storage_key: true,
              },
            },
          },
        },
      },
    })

    const buildThumbnailUrl = (storageKey: string): string => {
      if (cdnUrl) return `${cdnUrl}/${storageKey}`
      return storageKey
    }

    return orders
      .filter((o) => o.items.some((i) => !i.photo.retouched_storage_key))
      .map((o) => ({
        orderId: o.id,
        orderCreatedAt: o.created_at,
        eventName: o.event.name,
        userName: [o.user.first_name, o.user.last_name].filter(Boolean).join(' '),
        photos: o.items.map((i) => ({
          id: i.photo.id,
          filename: i.photo.filename,
          thumbnailUrl: buildThumbnailUrl(i.photo.storage_key),
          isRetouched: !!i.photo.retouched_storage_key,
        })),
      }))
  }
}
