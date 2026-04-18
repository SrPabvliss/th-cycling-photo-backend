import type { CdnUrlBuilder } from '@shared/cloudflare/infrastructure'
import type {
  ActiveEventProjection,
  CompletedEventProjection,
  DashboardSummaryProjection,
  OperatorDashboardProjection,
  RecentActivityProjection,
} from '../../application/projections'
import type {
  AssignedEventRow,
  LastActionDate,
  RecentActivityRow,
  RetouchProgress,
} from '../../domain/ports'

export function toActiveEventProjection(
  event: AssignedEventRow,
  retouch: RetouchProgress,
  coverUrl: string | null,
): ActiveEventProjection {
  return {
    eventId: event.eventId,
    name: event.name,
    date: formatDate(event.eventDate),
    location: event.location,
    coverUrl,
    retouch: {
      pendingOrders: retouch.pendingOrders,
      pendingPhotos: retouch.pendingPhotos,
    },
  }
}

export function toCompletedEventProjection(
  event: AssignedEventRow,
  totalRetouched: number,
  completedAt: Date,
  coverUrl: string | null,
): CompletedEventProjection {
  return {
    eventId: event.eventId,
    name: event.name,
    location: event.location,
    date: formatDate(event.eventDate),
    coverUrl,
    totalRetouched,
    completedAt: completedAt.toISOString(),
  }
}

export function toRecentActivityProjection(row: RecentActivityRow): RecentActivityProjection {
  return {
    type: 'retouch',
    eventName: row.eventName,
    description: `Foto retocada en ${row.eventName}`,
    timestamp: row.timestamp.toISOString(),
  }
}

export function toSummaryProjection(
  activeEvents: ActiveEventProjection[],
): DashboardSummaryProjection {
  return {
    assignedEventsCount: activeEvents.length,
    pendingRetouchCount: activeEvents.reduce((sum, event) => sum + event.retouch.pendingPhotos, 0),
  }
}

export function toDashboardProjection(
  activeEvents: ActiveEventProjection[],
  completedEvents: CompletedEventProjection[],
  recentActivity: RecentActivityProjection[],
): OperatorDashboardProjection {
  return {
    summary: toSummaryProjection(activeEvents),
    activeEvents,
    completedEvents,
    recentActivity,
  }
}

export function buildCoverUrl(publicSlug: string | null, cdn: CdnUrlBuilder): string | null {
  return publicSlug ? cdn.assetUrl(publicSlug, 'cover-lg') : null
}

export function resolveCompletedAt(actions: LastActionDate | undefined, fallback: Date): Date {
  const dates = [actions?.lastRetouchedAt]
    .filter((d): d is Date => d != null)
    .map((d) => d.getTime())
  return dates.length > 0 ? new Date(Math.max(...dates)) : fallback
}

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0]
}
