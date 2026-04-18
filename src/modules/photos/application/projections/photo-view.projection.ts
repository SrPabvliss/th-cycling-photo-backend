export class PhotoViewProjection {
  /** Event slug for back navigation */
  eventSlug: string
  /** Original filename */
  filename: string
  /** Pre-built signed workspace URL */
  imageUrl: string
  /** File size in bytes */
  fileSize: number
  /** MIME type */
  mimeType: string
  /** Current processing status */
  status: string
  /** Reason for classification failure, if any */
  unclassifiedReason: string | null
  /** When the photo was uploaded */
  uploadedAt: Date
  /** When processing completed */
  processedAt: Date | null
}
