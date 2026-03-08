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
  /** Current event status */
  status: string
  /** Total number of photos uploaded */
  totalPhotos: number
  /** Number of photos already processed */
  processedPhotos: number
}
