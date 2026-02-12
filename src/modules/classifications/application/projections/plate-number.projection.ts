export class PlateNumberProjection {
  /** Plate number value (1-999) */
  number: number
  /** OCR confidence score (0-1) */
  confidenceScore: number | null
  /** Whether the number was manually corrected */
  manuallyCorrected: boolean
}
