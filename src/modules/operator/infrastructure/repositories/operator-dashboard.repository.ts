import { Injectable } from '@nestjs/common'
import { PrismaService } from '@shared/infrastructure'
import type {
  AssignedEventRow,
  ClassificationProgress,
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
              select: { storage_key: true },
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
      coverStorageKey: a.event.assets[0]?.storage_key ?? null,
    }))
  }

  async getClassificationProgress(eventIds: string[]): Promise<ClassificationProgress[]> {
    if (eventIds.length === 0) return []

    const results = await this.prisma.photo.groupBy({
      by: ['event_id'],
      where: { event_id: { in: eventIds } },
      _count: { id: true },
    })

    const classifiedResults = await this.prisma.photo.groupBy({
      by: ['event_id'],
      where: {
        event_id: { in: eventIds },
        classified_at: { not: null },
      },
      _count: { id: true },
    })

    const totalMap = new Map(results.map((r) => [r.event_id, r._count.id]))
    const classifiedMap = new Map(classifiedResults.map((r) => [r.event_id, r._count.id]))

    return eventIds.map((eventId) => ({
      eventId,
      total: totalMap.get(eventId) ?? 0,
      classified: classifiedMap.get(eventId) ?? 0,
    }))
  }

  async getRetouchProgress(eventIds: string[]): Promise<RetouchProgress[]> {
    if (eventIds.length === 0) return []

    // Count paid orders with at least one unretouched photo, per event
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

    const [classifiedDates, retouchedDates] = await Promise.all([
      this.prisma.photo.groupBy({
        by: ['event_id'],
        where: { event_id: { in: eventIds }, classified_at: { not: null } },
        _max: { classified_at: true },
      }),
      this.prisma.photo.groupBy({
        by: ['event_id'],
        where: { event_id: { in: eventIds }, retouched_at: { not: null } },
        _max: { retouched_at: true },
      }),
    ])

    const classifiedMap = new Map(classifiedDates.map((r) => [r.event_id, r._max.classified_at]))
    const retouchedMap = new Map(retouchedDates.map((r) => [r.event_id, r._max.retouched_at]))

    return eventIds.map((eventId) => ({
      eventId,
      lastClassifiedAt: classifiedMap.get(eventId) ?? null,
      lastRetouchedAt: retouchedMap.get(eventId) ?? null,
    }))
  }

  async getRecentActivity(operatorId: string, limit: number): Promise<RecentActivityRow[]> {
    const [classifications, retouches] = await Promise.all([
      this.prisma.photo.findMany({
        where: {
          classified_at: { not: null },
          detected_participants: { some: { classified_by_id: operatorId } },
        },
        select: {
          classified_at: true,
          event: { select: { name: true } },
        },
        orderBy: { classified_at: 'desc' },
        take: limit,
      }),
      this.prisma.photo.findMany({
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
      }),
    ])

    const activities: RecentActivityRow[] = [
      ...classifications.map((p) => ({
        type: 'classification' as const,
        eventName: p.event.name,
        timestamp: p.classified_at!,
      })),
      ...retouches.map((p) => ({
        type: 'retouch' as const,
        eventName: p.event.name,
        timestamp: p.retouched_at!,
      })),
    ]

    activities.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())

    return activities.slice(0, limit)
  }
}
