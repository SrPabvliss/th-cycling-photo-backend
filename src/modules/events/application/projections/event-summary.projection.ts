/**
 * Minimal projection of an event for cross-module consumers (e.g. operator
 * dashboard). Carries identity, basic display fields and the photo count.
 * Heavier admin-oriented details live in EventListProjection / EventDetailProjection.
 */
export class EventSummaryProjection {
  /** Event UUID */
  id: string
  /** URL-friendly slug */
  slug: string
  /** Name of the event */
  name: string
  /** First day of the event (inclusive) */
  startDate: Date
  /** Last day of the event (inclusive) */
  endDate: Date
  /** Resolved location (canton, province) */
  location: string
  /** Cover image public CDN URL (null if no cover uploaded) */
  coverUrl: string | null
  /** Total number of photos uploaded to the event (includes failed) */
  totalPhotos: number
}
