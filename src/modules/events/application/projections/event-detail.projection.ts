export class EventDetailProjection {
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
  /** Province FK (for form pre-selection) */
  provinceId: number | null
  /** Canton FK (for form pre-selection) */
  cantonId: number | null
  /** Cover image public CDN URL (null if no cover uploaded). */
  coverImageUrl: string | null
  /** Public slug of the cover asset — used to build Worker preset URLs. */
  coverImageSlug: string | null
  /** Current event status */
  status: string
  /** Number of photos associated with this event (computed) */
  photoCount: number
  /** Number of classified photos (computed) */
  classifiedCount: number
  /** Total file size of all photos in bytes (computed) */
  totalFileSize: number
  /** When the event record was created */
  createdAt: Date
  /** When the event record was last updated */
  updatedAt: Date
}
