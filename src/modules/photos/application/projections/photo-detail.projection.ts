import type { DetectedParticipantProjection } from '@classifications/application/projections'

export class PhotoDetailProjection {
  /** Photo UUID */
  id: string
  /** Parent event UUID */
  eventId: string
  /** Original filename */
  filename: string
  /** Storage key for CDN URL resolution */
  storageKey: string
  /** Opaque public slug for gallery URL */
  publicSlug: string
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
  /** Storage key of the retouched version */
  retouchedStorageKey: string | null
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
