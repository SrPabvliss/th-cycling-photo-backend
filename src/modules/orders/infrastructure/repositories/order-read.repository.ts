import { Prisma } from '@generated/prisma/client'
import { Injectable } from '@nestjs/common'
import type {
  MyOrderCustomerState,
  MyOrderDetailProjection,
  MyOrderDownloadRaw,
  MyOrderListProjection,
  MyOrdersSummaryProjection,
  OrderDetailProjection,
  OrderListProjection,
  OrdersStatsProjection,
  RetouchCompletedOrderProjection,
} from '@orders/application/projections'
import type { Order } from '@orders/domain/entities'
import type { IOrderReadRepository, OrderListFilters } from '@orders/domain/ports'
import { resolveDeliveredFile } from '@orders/domain/services'
import { OrderStatus } from '@orders/domain/value-objects/order-status.vo'
import type { PendingRetouchOrderProjection } from '@photos/application/projections'
import { PaginatedResult, type Pagination } from '@shared/application'
import type { EventScope } from '@shared/authorization/domain/event-scope.vo'
import { CdnUrlBuilder } from '@shared/cloudflare/infrastructure'
import { PrismaService } from '@shared/infrastructure'
import * as OrderMapper from '../mappers/order.mapper'

const ORDER_LIST_SELECT = {
  id: true,
  status: true,
  created_at: true,
  notified_at: true,
  paid_at: true,
  delivered_at: true,
  cancelled_at: true,
  snap_first_name: true,
  snap_last_name: true,
  snap_phone: true,
  subtotal: true,
  snap_currency: true,
  payment_method: true,
  user: {
    select: {
      id: true,
      first_name: true,
      last_name: true,
      email: true,
      phones: {
        where: { is_primary: true },
        take: 1,
        select: { phone_number: true },
      },
    },
  },
  event: { select: { id: true, name: true } },
  _count: { select: { items: true } },
  delivery_link: { select: { id: true } },
  items: {
    take: 3,
    orderBy: { photo: { id: 'asc' } },
    select: {
      photo: { select: { id: true, public_slug: true, filename: true } },
    },
  },
} as const

const DOWNLOADABLE_STATUSES: string[] = [
  OrderStatus.PAID,
  OrderStatus.DELIVERED,
  OrderStatus.GIFTED,
]
const IN_PROCESS_STATUSES: string[] = [OrderStatus.PENDING, OrderStatus.PAYMENT_INFO_SENT]
const MY_ORDER_STATUSES: string[] = [
  OrderStatus.PENDING,
  OrderStatus.PAYMENT_INFO_SENT,
  OrderStatus.PAID,
  OrderStatus.DELIVERED,
  OrderStatus.GIFTED,
]
const SPENT_STATUSES: string[] = [OrderStatus.PAID, OrderStatus.DELIVERED]

function toCustomerState(status: string): MyOrderCustomerState {
  if (status === OrderStatus.GIFTED) return 'gifted'
  if (status === OrderStatus.PAID || status === OrderStatus.DELIVERED) return 'ready'
  if (status === OrderStatus.CANCELLED) return 'cancelled'
  return 'in_process'
}

@Injectable()
export class OrderReadRepository implements IOrderReadRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cdn: CdnUrlBuilder,
  ) {}

  /** Finds an order entity by ID. */
  async findById(id: string): Promise<Order | null> {
    const record = await this.prisma.order.findFirst({ where: { id } })
    return record ? OrderMapper.toEntity(record) : null
  }

  /** Scoped load — an out-of-scope id yields null (404), not a 403. */
  async findByIdInScope(id: string, scope: EventScope): Promise<Order | null> {
    const record = await this.prisma.order.findFirst({ where: { id, event: scope.toPrisma() } })
    return record ? OrderMapper.toEntity(record) : null
  }

  /** Retrieves a paginated list of orders with filters, scoped to the caller. */
  async getList(
    pagination: Pagination,
    filters: OrderListFilters,
    scope: EventScope,
  ): Promise<PaginatedResult<OrderListProjection>> {
    const where: Prisma.OrderWhereInput = { event: scope.toPrisma() }

    if (filters.eventId) where.event_id = filters.eventId
    if (filters.status) {
      where.status =
        filters.status === OrderStatus.DRAFT
          ? { in: [] }
          : (filters.status as Prisma.EnumOrderStatusFilter)
    } else {
      where.status = { not: OrderStatus.DRAFT }
    }
    if (filters.search) where.OR = this.buildSearchOr(filters.search)

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
        notifiedAt: o.notified_at,
        paidAt: o.paid_at,
        deliveredAt: o.delivered_at,
        cancelledAt: o.cancelled_at,
        userName: [o.snap_first_name, o.snap_last_name].filter(Boolean).join(' '),
        userId: o.user.id,
        customerFirstName: o.user.first_name,
        customerLastName: o.user.last_name,
        customerEmail: o.user.email,
        customerPrimaryPhone: o.user.phones[0]?.phone_number ?? null,
        snapWhatsapp: o.snap_phone,
        eventId: o.event.id,
        eventName: o.event.name,
        photoCount: o._count.items,
        subtotal: o.subtotal !== null ? o.subtotal.toString() : null,
        snapCurrency: o.snap_currency,
        hasDeliveryLink: o.delivery_link !== null,
        paymentMethod: o.payment_method,
        previewPhotos: o.items.map((it) => ({
          photoId: it.photo.id,
          publicSlug: it.photo.public_slug,
          filename: it.photo.filename,
          thumbnailUrl: this.cdn.internalUrl(it.photo.public_slug, 'thumb'),
        })),
      })),
      total,
      pagination,
    )
  }

  /** Retrieves order detail with user, photos, and delivery link, scoped to the caller. */
  async getDetail(id: string, scope: EventScope): Promise<OrderDetailProjection | null> {
    const record = await this.prisma.order.findFirst({
      where: { id, status: { not: OrderStatus.DRAFT }, event: scope.toPrisma() },
      select: {
        id: true,
        status: true,
        notes: true,
        created_at: true,
        notified_at: true,
        paid_at: true,
        delivered_at: true,
        cancelled_at: true,
        snap_first_name: true,
        snap_last_name: true,
        snap_phone: true,
        snap_email: true,
        subtotal: true,
        snap_currency: true,
        payment_method: true,
        user: {
          select: {
            first_name: true,
            last_name: true,
            phones: { where: { is_primary: true }, select: { phone_number: true }, take: 1 },
          },
        },
        event: { select: { id: true, name: true, tenant: { select: { name: true } } } },
        preview_link: { select: { token: true } },
        items: {
          select: {
            photo: {
              select: {
                id: true,
                filename: true,
                public_slug: true,
                retouched_storage_key: true,
              },
            },
          },
        },
        delivery_link: {
          select: {
            token: true,
            status: true,
            expires_at: true,
            download_count: true,
          },
        },
      },
    })

    if (!record) return null

    return {
      id: record.id,
      status: record.status,
      notes: record.notes,
      createdAt: record.created_at,
      notifiedAt: record.notified_at,
      paidAt: record.paid_at,
      deliveredAt: record.delivered_at,
      cancelledAt: record.cancelled_at,
      userName: [record.user.first_name, record.user.last_name].filter(Boolean).join(' '),
      snapFirstName: record.snap_first_name,
      snapLastName: record.snap_last_name,
      snapWhatsapp: record.snap_phone,
      snapEmail: record.snap_email,
      eventId: record.event.id,
      eventName: record.event.name,
      organizerName: record.event.tenant.name,
      customerPrimaryPhone: record.user.phones[0]?.phone_number ?? null,
      subtotal: record.subtotal !== null ? record.subtotal.toString() : null,
      snapCurrency: record.snap_currency,
      paymentMethod: record.payment_method,
      previewLinkToken: record.preview_link?.token ?? null,
      retouchProgress: {
        total: record.items.length,
        retouched: record.items.filter((oi) => !!oi.photo.retouched_storage_key).length,
      },
      photos: record.items.map((oi) => ({
        id: oi.photo.id,
        filename: oi.photo.filename,
        publicSlug: oi.photo.public_slug,
        thumbnailUrl: this.cdn.internalUrl(oi.photo.public_slug, 'thumb'),
        fullUrl: this.cdn.internalUrl(oi.photo.public_slug, 'workspace'),
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

  /** Counts orders grouped by status, optionally scoped to a single event, always scoped to the caller. */
  async countByStatus(
    eventId: string | undefined,
    scope: EventScope,
  ): Promise<Record<string, number>> {
    const groups = await this.prisma.order.groupBy({
      by: ['status'],
      where: {
        status: { not: OrderStatus.DRAFT },
        event: scope.toPrisma(),
        ...(eventId ? { event_id: eventId } : {}),
      },
      _count: { id: true },
    })
    return Object.fromEntries(groups.map((g) => [g.status, g._count.id]))
  }

  /** Sums subtotal of paid + delivered orders, optionally scoped to a single event, always scoped to the caller. */
  async sumRevenue(eventId: string | undefined, scope: EventScope): Promise<string> {
    const result = await this.prisma.order.aggregate({
      _sum: { subtotal: true },
      where: {
        status: { in: [OrderStatus.PAID, OrderStatus.DELIVERED] },
        event: scope.toPrisma(),
        ...(eventId ? { event_id: eventId } : {}),
      },
    })
    return (result._sum.subtotal ?? 0).toString()
  }

  /** Builds the case-insensitive search fragment shared by the list and the stats queries. */
  private buildSearchOr(term: string): Prisma.OrderWhereInput['OR'] {
    return [
      { snap_first_name: { contains: term, mode: 'insensitive' } },
      { snap_last_name: { contains: term, mode: 'insensitive' } },
      { snap_phone: { contains: term, mode: 'insensitive' } },
      { user: { first_name: { contains: term, mode: 'insensitive' } } },
      { user: { last_name: { contains: term, mode: 'insensitive' } } },
      { user: { email: { contains: term, mode: 'insensitive' } } },
      {
        user: {
          phones: {
            some: { phone_number: { contains: term, mode: 'insensitive' } },
          },
        },
      },
    ]
  }

  /**
   * Order statistics: totals, the open/awaiting-delivery figures and the seven tab counts.
   * Scoped to the caller, optionally to one event, optionally filtered by search — but never by
   * status: the tabs partition one population, so selecting a tab must not move these figures.
   */
  async getStats(filters: OrderListFilters, scope: EventScope): Promise<OrdersStatsProjection> {
    const where: Prisma.OrderWhereInput = {
      status: { not: OrderStatus.DRAFT },
      event: scope.toPrisma(),
      ...(filters.eventId ? { event_id: filters.eventId } : {}),
      ...(filters.search ? { OR: this.buildSearchOr(filters.search) } : {}),
    }

    const [statusGroups, openAmountAgg, awaitingDeliveryCount, revenueAgg] = await Promise.all([
      this.prisma.order.groupBy({ by: ['status'], where, _count: { id: true } }),
      this.prisma.order.aggregate({
        where: { ...where, status: { in: [OrderStatus.PENDING, OrderStatus.PAYMENT_INFO_SENT] } },
        _sum: { subtotal: true },
      }),
      this.prisma.order.count({
        where: {
          ...where,
          status: { in: [OrderStatus.PAID, OrderStatus.GIFTED] },
          delivered_at: null,
        },
      }),
      this.prisma.order.aggregate({
        where: { ...where, status: { in: [OrderStatus.PAID, OrderStatus.DELIVERED] } },
        _sum: { subtotal: true },
      }),
    ])

    const countOf = (status: string) =>
      statusGroups.find((g) => g.status === status)?._count.id ?? 0

    const pending = countOf(OrderStatus.PENDING)
    const paymentInfoSent = countOf(OrderStatus.PAYMENT_INFO_SENT)
    const paid = countOf(OrderStatus.PAID)
    const delivered = countOf(OrderStatus.DELIVERED)
    const gifted = countOf(OrderStatus.GIFTED)
    const cancelled = countOf(OrderStatus.CANCELLED)
    const total = pending + paymentInfoSent + paid + delivered + gifted + cancelled

    return {
      totalOrders: total,
      activeOrders: total - cancelled,
      pendingCount: pending,
      paymentInfoSentCount: paymentInfoSent,
      paidCount: paid + delivered,
      deliveredCount: delivered,
      giftedCount: gifted,
      cancelledCount: cancelled,
      totalRevenue: (revenueAgg._sum.subtotal ?? new Prisma.Decimal(0)).toFixed(2),
      openCount: pending + paymentInfoSent,
      openAmount: (openAmountAgg._sum.subtotal ?? new Prisma.Decimal(0)).toFixed(2),
      awaitingDeliveryCount,
      tabs: {
        all: total,
        pending,
        payment_info_sent: paymentInfoSent,
        paid,
        delivered,
        gifted,
        cancelled,
      },
    }
  }

  /** Checks if an order already exists for a preview link. */
  async existsByPreviewLinkId(previewLinkId: string): Promise<boolean> {
    const count = await this.prisma.order.count({
      where: { preview_link_id: previewLinkId },
    })
    return count > 0
  }

  /** Checks if any order line item references this photo. */
  async existsByPhotoId(photoId: string): Promise<boolean> {
    const count = await this.prisma.orderItem.count({
      where: { photo_id: photoId, order: { status: { not: OrderStatus.DRAFT } } },
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

  /** Returns paid orders with at least one un-retouched photo, ordered FIFO, scoped to the caller. */
  async getPendingRetouch(scope: EventScope): Promise<PendingRetouchOrderProjection[]> {
    const orders = await this.prisma.order.findMany({
      where: { status: 'paid', event: scope.toPrisma() },
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
                public_slug: true,
                retouched_storage_key: true,
              },
            },
          },
        },
      },
    })

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
          thumbnailUrl: this.cdn.internalUrl(i.photo.public_slug, 'thumb'),
          isRetouched: !!i.photo.retouched_storage_key,
        })),
      }))
  }

  /** Finds orders containing this photo where ALL items are now retouched. */
  async findOrdersFullyRetouchedByPhoto(
    photoId: string,
  ): Promise<RetouchCompletedOrderProjection[]> {
    const orders = await this.prisma.order.findMany({
      where: {
        items: { some: { photo_id: photoId } },
        NOT: [
          { items: { some: { photo: { retouched_at: null, requires_retouch: true } } } },
          { status: OrderStatus.DRAFT },
        ],
      },
      select: {
        id: true,
        event_id: true,
        event: { select: { name: true } },
        snap_first_name: true,
        snap_last_name: true,
        _count: { select: { items: true } },
      },
    })

    return orders.map(OrderMapper.toRetouchCompletedProjection)
  }

  /** Distinct photo IDs across the given orders' line items. */
  async getPhotoIdsByOrderIds(orderIds: string[]): Promise<string[]> {
    if (orderIds.length === 0) return []

    const items = await this.prisma.orderItem.findMany({
      where: { order_id: { in: orderIds } },
      select: { photo_id: true },
      distinct: ['photo_id'],
    })

    return items.map((i) => i.photo_id)
  }

  async getMyList(
    userId: string,
    pagination: Pagination,
  ): Promise<PaginatedResult<MyOrderListProjection>> {
    const where: Prisma.OrderWhereInput = {
      user_id: userId,
      status: { not: OrderStatus.DRAFT },
    }

    const [orders, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        select: {
          id: true,
          status: true,
          created_at: true,
          subtotal: true,
          snap_currency: true,
          event: { select: { name: true } },
          _count: { select: { items: true } },
          items: {
            take: 3,
            orderBy: { photo: { id: 'asc' } },
            select: { photo: { select: { id: true, public_slug: true } } },
          },
        },
        orderBy: { created_at: 'desc' },
        skip: pagination.skip,
        take: pagination.take,
      }),
      this.prisma.order.count({ where }),
    ])

    return new PaginatedResult(
      orders.map((order) => ({
        id: order.id,
        state: toCustomerState(order.status),
        eventName: order.event.name,
        createdAt: order.created_at,
        photoCount: order._count.items,
        subtotal: order.subtotal?.toString() ?? null,
        snapCurrency: order.snap_currency,
        previewPhotos: order.items.map((item) => ({
          photoId: item.photo.id,
          galleryUrl: this.cdn.galleryUrl(item.photo.public_slug),
        })),
      })),
      total,
      pagination,
    )
  }

  async getMyDetail(userId: string, orderId: string): Promise<MyOrderDetailProjection | null> {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, user_id: userId, status: { not: OrderStatus.DRAFT } },
      select: {
        id: true,
        status: true,
        created_at: true,
        subtotal: true,
        snap_currency: true,
        event: { select: { name: true } },
        items: {
          orderBy: { photo: { id: 'asc' } },
          select: { photo: { select: { id: true, public_slug: true } } },
        },
      },
    })

    if (!order) return null

    return {
      id: order.id,
      state: toCustomerState(order.status),
      eventName: order.event.name,
      createdAt: order.created_at,
      subtotal: order.subtotal?.toString() ?? null,
      snapCurrency: order.snap_currency,
      canDownload: DOWNLOADABLE_STATUSES.includes(order.status),
      canCancel: IN_PROCESS_STATUSES.includes(order.status),
      photos: order.items.map((item) => ({
        id: item.photo.id,
        galleryUrl: this.cdn.galleryUrl(item.photo.public_slug),
      })),
    }
  }

  async getMyDownloadFiles(userId: string, orderId: string): Promise<MyOrderDownloadRaw[] | null> {
    const order = await this.prisma.order.findFirst({
      where: {
        id: orderId,
        user_id: userId,
        status: { in: DOWNLOADABLE_STATUSES } as Prisma.EnumOrderStatusFilter,
      },
      select: {
        items: {
          orderBy: { photo: { id: 'asc' } },
          select: {
            delivered_as: true,
            photo: {
              select: {
                id: true,
                storage_key: true,
                file_size: true,
                retouched_storage_key: true,
                retouched_file_size: true,
              },
            },
          },
        },
      },
    })

    if (!order) return null

    return order.items.map((item) => {
      const file = resolveDeliveredFile({
        deliveredAs: item.delivered_as,
        storageKey: item.photo.storage_key,
        retouchedStorageKey: item.photo.retouched_storage_key,
        fileSize: item.photo.file_size,
        retouchedFileSize: item.photo.retouched_file_size,
      })
      return { id: item.photo.id, storageKey: file.storageKey, fileSize: file.fileSize }
    })
  }

  async getMySummary(userId: string): Promise<MyOrdersSummaryProjection> {
    const [orderCount, photoCount, events, spentGroups] = await Promise.all([
      this.prisma.order.count({
        where: {
          user_id: userId,
          status: { in: MY_ORDER_STATUSES } as Prisma.EnumOrderStatusFilter,
        },
      }),
      this.prisma.orderItem.count({
        where: {
          order: {
            user_id: userId,
            status: { in: DOWNLOADABLE_STATUSES } as Prisma.EnumOrderStatusFilter,
          },
        },
      }),
      this.prisma.order.findMany({
        where: {
          user_id: userId,
          status: { in: MY_ORDER_STATUSES } as Prisma.EnumOrderStatusFilter,
        },
        distinct: ['event_id'],
        select: { event_id: true },
      }),
      this.prisma.order.groupBy({
        by: ['snap_currency'],
        where: {
          user_id: userId,
          status: { in: SPENT_STATUSES } as Prisma.EnumOrderStatusFilter,
          subtotal: { not: null },
          snap_currency: { not: null },
        },
        _sum: { subtotal: true },
      }),
    ])

    return {
      orderCount,
      photoCount,
      eventCount: events.length,
      spent: spentGroups
        .filter((group) => group.snap_currency !== null && group._sum.subtotal !== null)
        .map((group) => ({
          currency: group.snap_currency as string,
          amount: (
            group._sum.subtotal as NonNullable<(typeof group)['_sum']['subtotal']>
          ).toString(),
        })),
    }
  }

  async hasPaymentInFlight(orderId: string): Promise<boolean> {
    const count = await this.prisma.paymentTransactionOrder.count({
      where: {
        order_id: orderId,
        payment_transaction: { status: { in: ['initiated', 'confirming'] } },
      },
    })
    return count > 0
  }
}
