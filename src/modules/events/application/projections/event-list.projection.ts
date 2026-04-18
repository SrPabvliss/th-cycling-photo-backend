export class EventListProjection {
  /** Event UUID */
  id: string
  /** URL-friendly slug */
  slug: string
  /** Name of the cycling event */
  name: string
  /** Date when the event takes place */
  date: Date
  /** Province name (resolved from relation) */
  provinceName: string | null
  /** Canton name (resolved from relation) */
  cantonName: string | null
  /** Cover image public CDN URL (null if no cover uploaded). */
  coverImageUrl: string | null
  /** Public slug of the cover asset — used to build Worker preset URLs. */
  coverImageSlug: string | null
  /** Whether this event is currently featured */
  isFeatured: boolean
  /** Current event status */
  status: string
  /** Number of photos associated with this event (computed) */
  photoCount: number
  /** Total file size of all photos in bytes (computed) */
  totalFileSize: number
}
