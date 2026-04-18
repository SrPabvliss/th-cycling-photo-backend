export class EventsStatsProjection {
  /** Total number of events (including archived) */
  totalEvents: number
  /** Total number of photos across all events */
  totalPhotos: number
  /** Total storage used by all photos in bytes */
  totalStorageBytes: number
}
