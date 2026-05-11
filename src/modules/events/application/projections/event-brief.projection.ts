/**
 * Minimal event identifier projection. Used when consumers only need to
 * resolve an event by id without paying for the heavier list/summary
 * projections (no cover, no totals).
 */
export class EventBriefProjection {
  id: string
  slug: string
  name: string
}
