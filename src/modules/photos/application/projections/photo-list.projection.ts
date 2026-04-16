export class PhotoListProjection {
  /** Photo UUID */
  id: string
  /** Parent event UUID */
  eventId: string
  /** Original filename */
  filename: string
  /** Opaque public slug for gallery URL */
  publicSlug: string
  /** Pre-built signed thumbnail URL (internal, 400px) */
  thumbnailUrl: string
  /** Current processing status */
  status: string
  /** Image width in pixels */
  width: number | null
  /** Image height in pixels */
  height: number | null
  /** When the photo was uploaded */
  uploadedAt: Date
  /** When the photo was classified (null if not yet classified) */
  classifiedAt: Date | null
}
