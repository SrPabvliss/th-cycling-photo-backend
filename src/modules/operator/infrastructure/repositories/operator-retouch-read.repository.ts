import { Injectable } from '@nestjs/common'
import { PrismaService } from '@shared/infrastructure'
import type {
  IOperatorRetouchReadRepository,
  OperatorRetouchOrderDetailRow,
  OperatorRetouchOrderRow,
  OperatorRetouchQueueOrderRow,
  RetouchOrderScope,
} from '../../domain/ports'

const PENDING_PHOTO_FILTER = { retouched_at: null, requires_retouch: true } as const
const RETOUCHED_PHOTO_FILTER = { retouched_at: { not: null } } as const

function buildOrdersWhere(eventIds: string[] | null, scope: RetouchOrderScope) {
  const base = {
    ...(eventIds === null ? {} : { event_id: { in: eventIds } }),
    status: 'paid' as const,
  }
  if (scope === 'pending') {
    return {
      ...base,
      items: { some: { photo: PENDING_PHOTO_FILTER } },
    }
  }
  // 'completed': has at least one retouched photo AND no pending photos remain.
  return {
    ...base,
    items: { some: { photo: RETOUCHED_PHOTO_FILTER } },
    NOT: { items: { some: { photo: PENDING_PHOTO_FILTER } } },
  }
}

@Injectable()
export class OperatorRetouchReadRepository implements IOperatorRetouchReadRepository {
  constructor(private readonly prisma: PrismaService) {}

  async getRetouchQueuePage(
    eventId: string,
    scope: RetouchOrderScope,
    skip: number,
    take: number,
  ): Promise<{ items: OperatorRetouchQueueOrderRow[]; total: number }> {
    const where =
      scope === 'pending'
        ? {
            event_id: eventId,
            status: 'paid' as const,
            items: { some: { photo: PENDING_PHOTO_FILTER } },
          }
        : {
            event_id: eventId,
            status: 'paid' as const,
            items: { some: { photo: RETOUCHED_PHOTO_FILTER } },
            NOT: { items: { some: { photo: PENDING_PHOTO_FILTER } } },
          }

    const itemsWhere = scope === 'pending' ? { photo: PENDING_PHOTO_FILTER } : undefined

    const [orders, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        orderBy: { created_at: 'asc' },
        skip,
        take,
        select: {
          id: true,
          event_id: true,
          event: { select: { name: true } },
          snap_first_name: true,
          snap_last_name: true,
          created_at: true,
          items: {
            where: itemsWhere,
            select: {
              photo: {
                select: {
                  id: true,
                  public_slug: true,
                  filename: true,
                  retouched_storage_key: true,
                },
              },
            },
          },
        },
      }),
      this.prisma.order.count({ where }),
    ])

    const items: OperatorRetouchQueueOrderRow[] = orders.map((order) => ({
      orderId: order.id,
      buyerName: [order.snap_first_name, order.snap_last_name].filter(Boolean).join(' '),
      eventId: order.event_id,
      eventName: order.event.name,
      createdAt: order.created_at,
      items: order.items.map((item) => ({
        photoId: item.photo.id,
        publicSlug: item.photo.public_slug,
        filename: item.photo.filename,
        retouchedStorageKey: item.photo.retouched_storage_key,
      })),
    }))

    return { items, total }
  }

  async findOperatorRetouchOrdersPage(
    eventIds: string[] | null,
    scope: RetouchOrderScope,
    skip: number,
    take: number,
  ): Promise<{ items: OperatorRetouchOrderRow[]; total: number }> {
    const where = buildOrdersWhere(eventIds, scope)
    const previewItemsWhere =
      scope === 'pending' ? { photo: PENDING_PHOTO_FILTER } : { photo: RETOUCHED_PHOTO_FILTER }

    const orderScopeWhere = {
      order: {
        ...(eventIds === null ? {} : { event_id: { in: eventIds } }),
        status: 'paid' as const,
      },
    }

    const [orders, total, totalCounts, retouchedCounts, pendingCounts] = await Promise.all([
      this.prisma.order.findMany({
        where,
        orderBy: { created_at: 'asc' },
        skip,
        take,
        select: {
          id: true,
          event_id: true,
          event: { select: { name: true } },
          snap_first_name: true,
          snap_last_name: true,
          created_at: true,
          items: {
            where: previewItemsWhere,
            take: 3,
            orderBy: { photo: { id: 'asc' } },
            select: {
              photo: {
                select: {
                  id: true,
                  public_slug: true,
                  filename: true,
                  retouched_storage_key: true,
                },
              },
            },
          },
        },
      }),
      this.prisma.order.count({ where }),
      this.prisma.orderItem.groupBy({
        by: ['order_id'],
        where: orderScopeWhere,
        _count: { _all: true },
      }),
      this.prisma.orderItem.groupBy({
        by: ['order_id'],
        where: { ...orderScopeWhere, photo: RETOUCHED_PHOTO_FILTER },
        _count: { _all: true },
      }),
      this.prisma.orderItem.groupBy({
        by: ['order_id'],
        where: { ...orderScopeWhere, photo: PENDING_PHOTO_FILTER },
        _count: { _all: true },
      }),
    ])

    const totalByOrderId = new Map(totalCounts.map((e) => [e.order_id, e._count?._all ?? 0]))
    const retouchedByOrderId = new Map(
      retouchedCounts.map((e) => [e.order_id, e._count?._all ?? 0]),
    )
    const pendingByOrderId = new Map(pendingCounts.map((e) => [e.order_id, e._count?._all ?? 0]))

    const items: OperatorRetouchOrderRow[] = orders.map((order) => ({
      orderId: order.id,
      buyerName: [order.snap_first_name, order.snap_last_name].filter(Boolean).join(' '),
      eventId: order.event_id,
      eventName: order.event.name,
      createdAt: order.created_at,
      pendingPhotosCount: pendingByOrderId.get(order.id) ?? 0,
      totalPhotosCount: totalByOrderId.get(order.id) ?? 0,
      retouchedPhotosCount: retouchedByOrderId.get(order.id) ?? 0,
      previewPhotos: order.items.map((item) => ({
        photoId: item.photo.id,
        publicSlug: item.photo.public_slug,
        filename: item.photo.filename,
        retouchedStorageKey: item.photo.retouched_storage_key,
      })),
    }))

    return { items, total }
  }

  async findOrderDetailRow(
    orderId: string,
    onlyPending: boolean,
  ): Promise<OperatorRetouchOrderDetailRow | null> {
    const itemsWhere = onlyPending ? { photo: PENDING_PHOTO_FILTER } : undefined
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        event_id: true,
        event: { select: { name: true } },
        snap_first_name: true,
        snap_last_name: true,
        created_at: true,
        items: {
          where: itemsWhere,
          orderBy: { photo: { id: 'asc' } },
          select: {
            photo: {
              select: {
                id: true,
                public_slug: true,
                filename: true,
                retouched_storage_key: true,
              },
            },
          },
        },
      },
    })

    if (!order) return null

    return {
      orderId: order.id,
      buyerName: [order.snap_first_name, order.snap_last_name].filter(Boolean).join(' '),
      eventId: order.event_id,
      eventName: order.event.name,
      createdAt: order.created_at,
      photos: order.items.map((item) => ({
        photoId: item.photo.id,
        publicSlug: item.photo.public_slug,
        filename: item.photo.filename,
        retouchedStorageKey: item.photo.retouched_storage_key,
      })),
    }
  }

  async findPhotoEventId(photoId: string): Promise<string | null> {
    const photo = await this.prisma.photo.findUnique({
      where: { id: photoId },
      select: { event_id: true },
    })
    return photo?.event_id ?? null
  }

  async isOperatorAssigned(eventId: string, operatorId: string): Promise<boolean> {
    const record = await this.prisma.eventOperator.findUnique({
      where: { event_id_user_id: { event_id: eventId, user_id: operatorId } },
      select: { id: true },
    })
    return record !== null
  }
}
