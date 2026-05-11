import type { EventBriefProjection } from '@events/application/projections'
import type { ReviewQueueByEventsRepoItem } from '@photos/domain/ports'
import type { CdnUrlBuilder } from '@shared/cloudflare/infrastructure'
import type { OperatorReviewQueueItemProjection } from '../../application/projections'

/**
 * Maps a Photo review queue row plus its resolved event brief to the
 * cross-event review queue projection. Falls back to a stub event payload
 * when the brief lookup didn't resolve (event soft-deleted between calls,
 * race condition, etc).
 */
export function toOperatorReviewQueueItemProjection(
  row: ReviewQueueByEventsRepoItem,
  event: EventBriefProjection | undefined,
  cdn: CdnUrlBuilder,
): OperatorReviewQueueItemProjection {
  return {
    id: row.id,
    publicSlug: row.publicSlug,
    filename: row.filename,
    thumbnailUrl: cdn.internalUrl(row.publicSlug, 'thumb'),
    status: row.status,
    reviewedAt: row.reviewedAt,
    minBibConfidence: row.minBibConfidence,
    bibsCount: row.bibsCount,
    colorsCount: row.colorsCount,
    event: event
      ? { id: event.id, slug: event.slug, name: event.name }
      : { id: row.eventId, slug: '', name: '' },
  }
}
