export class PlateNumberProjection {
  /** PlateNumber UUID */
  id: string
  /** Detected plate number (1-9999) */
  number: number
  /** AI confidence score (null for manual) */
  confidenceScore: number | null
  /** Whether an operator corrected this value */
  manuallyCorrected: boolean
  /** When the correction was made */
  correctedAt: Date | null
}
