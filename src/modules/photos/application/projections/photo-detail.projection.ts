import type { AttributeSource, BibReadingStatus, ColorRegion } from '@generated/prisma/client'

export class BibAttributeProjection {
  /** PhotoBib UUID */
  id: string
  /** Detected/corrected bib digits (raw AI value for now; effective resolution lands in Spec C) */
  digits: string
  /** Original digits as read by AI before any corrections. */
  digitsOriginal: string
  /** True if a reviewer correction has been applied to digits. */
  wasCorrected: boolean
  /** Timestamp of latest digits correction; null if none. */
  correctedAt: Date | null
  /** OCR matching status against startlist; null when no startlist info available */
  status: BibReadingStatus | null
  /** Confidence in [0,1] */
  confidence: number | null
  /** ai (pipeline) | reviewer (manual; available once Spec C lands) */
  source: AttributeSource
  /** Pre-signed download URL (TTL 3600s); null when no crop persisted or signing failed */
  cropUrl: string | null
}

export class ColorAttributeProjection {
  /** PhotoColor UUID */
  id: string
  /** Body region the color was sampled from */
  region: ColorRegion
  /** Primary color name (Spanish palette) */
  primaryColor: string
  /** Original primary color as detected by AI before any corrections. */
  primaryColorOriginal: string
  /** True if a reviewer correction has been applied to primary color. */
  primaryWasCorrected: boolean
  /** Optional secondary color name */
  secondaryColor: string | null
  /** Original secondary color as detected by AI before any corrections. */
  secondaryColorOriginal: string | null
  /** True if a reviewer correction has been applied to secondary color. */
  secondaryWasCorrected: boolean
  /** Confidence in [0,1] */
  confidence: number | null
  source: AttributeSource
  /** Pre-signed download URL (TTL 3600s); null when no crop persisted or signing failed */
  cropUrl: string | null
}

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
  /** When the photo was marked as reviewed by an operator */
  reviewedAt: Date | null
  /** AI- and reviewer-generated bib attributes for this photo */
  bibs: BibAttributeProjection[]
  /** AI- and reviewer-generated color attributes for this photo */
  colors: ColorAttributeProjection[]
}
