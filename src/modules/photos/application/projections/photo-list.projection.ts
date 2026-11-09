export class PhotoListBib {
  /** Effective digits: the latest human correction if one exists, else what was read */
  digits: string
  source: 'ai' | 'reviewer'
  /** Model confidence, 0..1. Null for a bib a person typed. */
  confidence: number | null
  status: 'read' | 'abstained' | null
  /** A `corrections` row exists for this bib's digits */
  corrected: boolean
}

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
  /** When the photo was marked as reviewed (null if not yet reviewed) */
  reviewedAt: Date | null
  /** Bibs read on this photo, oldest first. Empty means nobody can find it by number. */
  bibs: PhotoListBib[]
  /** Category FK, null when uncategorized */
  photoCategoryId: number | null
  /** Category name, null when uncategorized */
  photoCategoryName: string | null
  /** Belongs to an order whose status is `paid` or `delivered` */
  sold: boolean
}
