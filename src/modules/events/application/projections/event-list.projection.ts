import type { EventAlert } from '@events/domain/event-alert'

export class EventListProjection {
  /** Event UUID */
  id: string
  /** URL-friendly slug */
  slug: string
  /** Name of the cycling event */
  name: string
  /** First day of the event (inclusive) */
  startDate: Date
  /** Last day of the event (inclusive) */
  endDate: Date
  /** Province name (resolved from relation) */
  provinceName: string | null
  /** Canton name (resolved from relation) */
  cantonName: string | null
  /** Cover image public CDN URL (null if no cover uploaded). */
  coverImageUrl: string | null
  /** Public slug of the cover asset — used to build Worker preset URLs. */
  coverImageSlug: string | null
  /** Current event status */
  status: string
  /** Whether the event is frozen (read-only for everyone until unfrozen) */
  isFrozen: boolean
  /** Number of photos associated with this event (computed) */
  photoCount: number
  /** Total file size of all photos in bytes (computed) */
  totalFileSize: number
  /** Organizer UUID */
  organizerId: string
  /** Organizer's commercial name */
  organizerName: string
  /** Maximum number of photos allowed for this event */
  photoQuota: number | null
  /** Number of photos uploaded to this event */
  photosUploaded: number
  /** Number of photos marked as reviewed */
  reviewedCount: number
  /** Number of photos categorized */
  categorizedCount: number
  /** Total revenue from orders (decimal string) */
  revenue: string
  /** Number of paid orders */
  paidCount: number
  /** Number of delivered orders */
  deliveredCount: number
  /** Number of gifted orders */
  giftedCount: number
  /** Number of unpaid orders */
  unpaidCount: number
  /** Number of cancelled orders */
  cancelledCount: number
  soldPhotoCount: number
  /** Timestamp of the last photo upload */
  lastUploadAt: Date | null
  /** Whether the event is archived */
  isArchived: boolean
  /** Alert status for the event */
  alert: EventAlert
}
