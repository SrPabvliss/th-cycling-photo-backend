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
  ClassificationProgress,
  LastActionDate,
  RecentActivityRow,
  RetouchProgress,
} from '../../domain/ports'

export function toActiveEventProjection(
  event: AssignedEventRow,
  classification: ClassificationProgress,
  retouch: RetouchProgress,
  coverUrl: string | null,
): ActiveEventProjection {
  const percentage =
    classification.total > 0
      ? Math.round((classification.classified / classification.total) * 100)
      : 0

  return {
    eventId: event.eventId,
    name: event.name,
    date: formatDate(event.eventDate),
    location: event.location,
    coverUrl,
    classification: {
      total: classification.total,
      classified: classification.classified,
      percentage,
    },
    retouch: {
      pendingOrders: retouch.pendingOrders,
      pendingPhotos: retouch.pendingPhotos,
    },
    hasProgress: classification.classified > 0,
  }
}

export function toCompletedEventProjection(
  event: AssignedEventRow,
  classifiedCount: number,
  completedAt: Date,
  coverUrl: string | null,
): CompletedEventProjection {
  return {
    eventId: event.eventId,
    name: event.name,
    location: event.location,
    date: formatDate(event.eventDate),
    coverUrl,
    totalClassified: classifiedCount,
    completedAt: completedAt.toISOString(),
  }
}

export function toRecentActivityProjection(row: RecentActivityRow): RecentActivityProjection {
  const descriptions: Record<RecentActivityRow['type'], string> = {
    classification: `Classified photo in ${row.eventName}`,
    retouch: `Retouched photo in ${row.eventName}`,
  }

  return {
    type: row.type,
    eventName: row.eventName,
    description: descriptions[row.type],
    timestamp: row.timestamp.toISOString(),
  }
}

export function toSummaryProjection(
  activeEvents: ActiveEventProjection[],
): DashboardSummaryProjection {
  return {
    assignedEventsCount: activeEvents.length,
    pendingPhotosCount: activeEvents.reduce(
      (sum, event) => sum + (event.classification.total - event.classification.classified),
      0,
    ),
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
  return publicSlug ? cdn.assetUrl(publicSlug, 'cover-sm') : null
}

export function resolveCompletedAt(actions: LastActionDate | undefined, fallback: Date): Date {
  const dates = [actions?.lastClassifiedAt, actions?.lastRetouchedAt]
    .filter((d): d is Date => d != null)
    .map((d) => d.getTime())

  return dates.length > 0 ? new Date(Math.max(...dates)) : fallback
}

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0]
}
