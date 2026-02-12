import type { DetectedCyclistProjection } from '@classifications/application/projections'

export class PhotoDetailProjection {
  /** Photo UUID */
  id: string
  /** Parent event UUID */
  eventId: string
  /** Original filename */
  filename: string
  /** Storage key for CDN URL resolution */
  storageKey: string
  /** File size in bytes */
  fileSize: bigint
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
  /** When the photo was captured (from EXIF) */
  capturedAt: Date | null
  /** When the photo was uploaded */
  uploadedAt: Date
  /** When processing completed */
  processedAt: Date | null
  /** Detected cyclists with plate numbers and equipment colors */
  detectedCyclists: DetectedCyclistProjection[]
}
