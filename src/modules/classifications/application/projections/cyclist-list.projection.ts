export class CyclistListProjection {
  /** Cyclist UUID */
  id: string
  /** Photo UUID this cyclist belongs to */
  photoId: string
  /** Classification source: 'manual' or 'ai' */
  source: string
  /** Plate number (if detected) */
  plateNumber: number | null
  /** Number of colors associated with this cyclist */
  colorCount: number
  /** When this cyclist was classified */
  createdAt: Date
  /** When this cyclist was last updated */
  updatedAt: Date
}
