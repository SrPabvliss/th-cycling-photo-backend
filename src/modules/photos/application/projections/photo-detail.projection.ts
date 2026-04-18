import type { DetectedParticipantProjection } from '@classifications/application/projections'

export class PhotoDetailProjection {
  /** Photo UUID */
  id: string
  /** Parent event UUID */
  eventId: string
  /** Parent event slug for navigation */
  eventSlug: string
  /** Original filename */
  filename: string
  /** Opaque public slug for gallery URL */
  publicSlug: string
  /** Pre-built signed workspace URL (internal, 1400px) */
  imageUrl: string
  /** Pre-built signed thumbnail URL (internal, 400px) */
  thumbnailUrl: string
  /** File size in bytes */
  fileSize: number
  /** MIME type */
  mimeType: string
  /** Image width in pixels */
  width: number | null
  /** Image height in pixels */
  height: number | null
  /** Current processing status */
  status: string
  /** Reason for classification failure, if any */
  unclassifiedReason: string | null
  /** Pre-built signed URL for retouched version (null if not retouched) */
  retouchedImageUrl: string | null
  /** Retouched file size in bytes */
  retouchedFileSize: number | null
  /** When the retouched version was uploaded */
  retouchedAt: Date | null
  /** When the photo was captured (from EXIF) */
  capturedAt: Date | null
  /** When the photo was uploaded */
  uploadedAt: Date
  /** When processing completed */
  processedAt: Date | null
  /** When an operator marked this photo as classified */
  classifiedAt: Date | null
  /** Detected participants with identifiers and gear colors */
  detectedParticipants: DetectedParticipantProjection[]
}
