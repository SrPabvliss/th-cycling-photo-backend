export class EventListProjection {
  /** Event UUID */
  id: string
  /** Name of the cycling event */
  name: string
  /** Date when the event takes place */
  date: Date
  /** Legacy free-text location (preserved for data migration) */
  location: string | null
  /** Province name (resolved from relation) */
  provinceName: string | null
  /** Canton name (resolved from relation) */
  cantonName: string | null
  /** Cover image URL (manual upload URL or first photo storage key for fallback) */
  coverImageUrl: string | null
  /** Source of the cover image: 'manual', 'auto' (first photo), or null */
  coverImageSource: 'manual' | 'auto' | null
  /** Current event status */
  status: string
  /** Number of photos associated with this event (computed) */
  photoCount: number
  /** Number of classified photos (computed) */
  classifiedCount: number
  /** Total file size of all photos in bytes (computed) */
  totalFileSize: number
}
