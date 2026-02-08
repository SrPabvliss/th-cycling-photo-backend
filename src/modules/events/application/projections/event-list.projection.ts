export class EventListProjection {
  /** Event UUID */
  id: string
  /** Name of the cycling event */
  name: string
  /** Date when the event takes place */
  date: Date
  /** Physical location or address */
  location: string | null
  /** Current event status */
  status: string
  /** Total number of photos uploaded */
  totalPhotos: number
  /** Number of photos already processed */
  processedPhotos: number
}
