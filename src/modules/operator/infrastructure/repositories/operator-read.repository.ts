import { Injectable } from '@nestjs/common'
import { PrismaService } from '@shared/infrastructure'
import type {
  ActiveEventStats,
  CompletedEventStats,
  IOperatorReadRepository,
  RecentActivityRow,
  RecentActivityType,
} from '../../domain/ports'

const ACTIVITY_GROUP_WINDOW_MS = 30 * 60 * 1000

interface RawActivityEvent {
  type: RecentActivityType
  timestamp: Date
  eventId: string
  eventName: string
}

@Injectable()
export class OperatorReadRepository implements IOperatorReadRepository {
  constructor(private readonly prisma: PrismaService) {}

  async countPendingReview(operatorId: string, eventIds: string[]): Promise<number> {
    if (eventIds.length === 0) return 0
    return this.prisma.photo.count({
      where: {
        event_id: { in: eventIds },
        status: { in: ['processed', 'reviewed'] },
        reviewed_at: null,
      },
    })
  }

  async countPendingRetouch(_operatorId: string, eventIds: string[]): Promise<number> {
    if (eventIds.length === 0) return 0
    const photos = await this.prisma.photo.findMany({
      where: {
        event_id: { in: eventIds },
        retouched_at: null,
        order_items: { some: { order: { status: 'paid' } } },
      },
      select: { id: true },
    })
    return photos.length
  }

  async getActiveEventStats(eventIds: string[]): Promise<Map<string, ActiveEventStats>> {
    if (eventIds.length === 0) return new Map()

    const [reviewGrouped, retouchPhotos] = await Promise.all([
      this.prisma.photo.groupBy({
        by: ['event_id', 'reviewed_at'],
        where: {
          event_id: { in: eventIds },
          status: { in: ['processed', 'reviewed'] },
        },
        _count: { id: true },
      }),
      this.prisma.photo.findMany({
        where: {
          event_id: { in: eventIds },
          retouched_at: null,
          order_items: { some: { order: { status: 'paid' } } },
        },
        select: { event_id: true },
      }),
    ])

    const reviewByEvent = reviewGrouped.reduce((acc, row) => {
      const current = acc.get(row.event_id) ?? { pending: 0, total: 0 }
      const updated = {
        pending: current.pending + (row.reviewed_at == null ? row._count.id : 0),
        total: current.total + row._count.id,
      }
      acc.set(row.event_id, updated)
      return acc
    }, new Map<string, { pending: number; total: number }>())

    const retouchByEvent = retouchPhotos.reduce((acc, p) => {
      acc.set(p.event_id, (acc.get(p.event_id) ?? 0) + 1)
      return acc
    }, new Map<string, number>())

    return eventIds.reduce((acc, eventId) => {
      const review = reviewByEvent.get(eventId) ?? { pending: 0, total: 0 }
      acc.set(eventId, {
        pendingPhotos: review.pending,
        totalProcessedPhotos: review.total,
        retouchPendingPhotos: retouchByEvent.get(eventId) ?? 0,
      })
      return acc
    }, new Map<string, ActiveEventStats>())
  }

  async getCompletedEventStats(eventIds: string[]): Promise<Map<string, CompletedEventStats>> {
    if (eventIds.length === 0) return new Map()

    const [retouchedAgg, reviewedAgg] = await Promise.all([
      this.prisma.photo.groupBy({
        by: ['event_id'],
        where: { event_id: { in: eventIds }, retouched_at: { not: null } },
        _max: { retouched_at: true },
        _count: { id: true },
      }),
      this.prisma.photo.groupBy({
        by: ['event_id'],
        where: { event_id: { in: eventIds }, reviewed_at: { not: null } },
        _max: { reviewed_at: true },
      }),
    ])

    const retouchedMap = new Map(
      retouchedAgg.map((r) => [r.event_id, { lastAt: r._max.retouched_at, total: r._count.id }]),
    )
    const reviewedMap = new Map(reviewedAgg.map((r) => [r.event_id, r._max.reviewed_at]))

    return eventIds.reduce((acc, eventId) => {
      const retouched = retouchedMap.get(eventId)
      const lastReviewed = reviewedMap.get(eventId) ?? null
      const candidates = [retouched?.lastAt ?? null, lastReviewed].filter(
        (d): d is Date => d != null,
      )
      const completedAt =
        candidates.length > 0 ? new Date(Math.max(...candidates.map((d) => d.getTime()))) : null
      acc.set(eventId, {
        totalRetouched: retouched?.total ?? 0,
        completedAt,
      })
      return acc
    }, new Map<string, CompletedEventStats>())
  }

  async getRecentActivity(
    operatorId: string,
    skip: number,
    take: number,
  ): Promise<{ items: RecentActivityRow[]; total: number }> {
    const fetchSize = (skip + take) * 5

    const [retouches, corrections] = await Promise.all([
      this.prisma.photo.findMany({
        where: { retouched_by_id: operatorId, retouched_at: { not: null } },
        select: {
          retouched_at: true,
          event_id: true,
          event: { select: { name: true } },
        },
        orderBy: { retouched_at: 'desc' },
        take: fetchSize,
      }),
      this.prisma.correction.findMany({
        where: { reviewer_id: operatorId },
        select: {
          corrected_at: true,
          photo: {
            select: {
              event_id: true,
              event: { select: { name: true } },
            },
          },
        },
        orderBy: { corrected_at: 'desc' },
        take: fetchSize,
      }),
    ])

    const retouchEvents: RawActivityEvent[] = retouches.map((r) => ({
      type: 'retouch',
      timestamp: r.retouched_at!,
      eventId: r.event_id,
      eventName: r.event.name,
    }))

    const reviewEvents: RawActivityEvent[] = corrections.map((c) => ({
      type: 'review',
      timestamp: c.corrected_at,
      eventId: c.photo.event_id,
      eventName: c.photo.event.name,
    }))

    const all = [...retouchEvents, ...reviewEvents].sort(
      (a, b) => b.timestamp.getTime() - a.timestamp.getTime(),
    )

    const buckets = all.reduce<RecentActivityRow[]>((acc, row) => {
      const last = acc[acc.length - 1]
      const sameBucket =
        last !== undefined &&
        last.type === row.type &&
        last.eventId === row.eventId &&
        last.timestamp.getTime() - row.timestamp.getTime() <= ACTIVITY_GROUP_WINDOW_MS
      if (sameBucket) {
        last.count += 1
        return acc
      }
      acc.push({
        id: `${row.type}-${row.eventId}-${row.timestamp.getTime()}`,
        type: row.type,
        eventId: row.eventId,
        eventName: row.eventName,
        count: 1,
        timestamp: row.timestamp,
      })
      return acc
    }, [])

    return {
      items: buckets.slice(skip, skip + take),
      total: buckets.length,
    }
  }
}
