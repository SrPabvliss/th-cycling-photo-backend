export class PhotoListProjection {
  /** Photo UUID */
  id: string
  /** Public slug for navigation */
  publicSlug: string
  /** Original filename */
  filename: string
  /** Pre-built signed thumbnail URL (internal, 400px) */
  thumbnailUrl: string
  /** Current processing status */
  status: string
  /** When the photo was uploaded */
  uploadedAt: Date
  /** When the photo was classified (null if not yet classified) */
  classifiedAt: Date | null
}
