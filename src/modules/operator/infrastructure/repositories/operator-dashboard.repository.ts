import { Injectable } from '@nestjs/common'
import { PrismaService } from '@shared/infrastructure'
import type {
  AssignedEventRow,
  IOperatorDashboardRepository,
  LastActionDate,
  RecentActivityRow,
  RetouchProgress,
} from '../../domain/ports'

@Injectable()
export class OperatorDashboardRepository implements IOperatorDashboardRepository {
  constructor(private readonly prisma: PrismaService) {}

  async getAssignedEvents(operatorId: string): Promise<AssignedEventRow[]> {
    const assignments = await this.prisma.eventOperator.findMany({
      where: {
        user_id: operatorId,
        event: { status: 'active', deleted_at: null },
      },
      select: {
        event: {
          select: {
            id: true,
            name: true,
            event_date: true,
            canton: { select: { name: true } },
            province: { select: { name: true } },
            assets: {
              where: { asset_type: 'cover_image' },
              select: { public_slug: true },
              take: 1,
            },
          },
        },
      },
    })

    return assignments.map((a) => ({
      eventId: a.event.id,
      name: a.event.name,
      eventDate: a.event.event_date,
      location: [a.event.canton?.name, a.event.province?.name].filter(Boolean).join(', '),
      coverPublicSlug: a.event.assets[0]?.public_slug ?? null,
    }))
  }

  async getRetouchProgress(eventIds: string[]): Promise<RetouchProgress[]> {
    if (eventIds.length === 0) return []

    const ordersWithPending = await this.prisma.order.findMany({
      where: {
        event_id: { in: eventIds },
        status: 'paid',
        items: { some: { photo: { retouched_at: null } } },
      },
      select: {
        event_id: true,
        items: {
          where: { photo: { retouched_at: null } },
          select: { id: true },
        },
      },
    })

    const progressMap = new Map<string, { pendingOrders: number; pendingPhotos: number }>()

    for (const order of ordersWithPending) {
      const current = progressMap.get(order.event_id) ?? { pendingOrders: 0, pendingPhotos: 0 }
      current.pendingOrders += 1
      current.pendingPhotos += order.items.length
      progressMap.set(order.event_id, current)
    }

    return eventIds.map((eventId) => ({
      eventId,
      pendingOrders: progressMap.get(eventId)?.pendingOrders ?? 0,
      pendingPhotos: progressMap.get(eventId)?.pendingPhotos ?? 0,
    }))
  }

  async getLastActionDates(eventIds: string[]): Promise<LastActionDate[]> {
    if (eventIds.length === 0) return []

    const retouchedData = await this.prisma.photo.groupBy({
      by: ['event_id'],
      where: { event_id: { in: eventIds }, retouched_at: { not: null } },
      _max: { retouched_at: true },
      _count: { id: true },
    })

    const retouchedMap = new Map(
      retouchedData.map((r) => [
        r.event_id,
        { lastRetouchedAt: r._max.retouched_at, totalRetouched: r._count.id },
      ]),
    )

    return eventIds.map((eventId) => ({
      eventId,
      lastRetouchedAt: retouchedMap.get(eventId)?.lastRetouchedAt ?? null,
      totalRetouched: retouchedMap.get(eventId)?.totalRetouched ?? 0,
    }))
  }

  async getRecentActivity(operatorId: string, limit: number): Promise<RecentActivityRow[]> {
    const retouches = await this.prisma.photo.findMany({
      where: {
        retouched_by_id: operatorId,
        retouched_at: { not: null },
      },
      select: {
        retouched_at: true,
        event: { select: { name: true } },
      },
      orderBy: { retouched_at: 'desc' },
      take: limit,
    })

    return retouches.map((p) => ({
      type: 'retouch' as const,
      eventName: p.event.name,
      timestamp: p.retouched_at!,
    }))
  }
}
