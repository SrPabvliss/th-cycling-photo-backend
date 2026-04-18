export class IdentifierProjection {
  /** ParticipantIdentifier UUID */
  id: string
  /** Detected identifier value */
  value: string
  /** AI confidence score (null for manual) */
  confidenceScore: number | null
  /** Whether an operator corrected this value */
  manuallyCorrected: boolean
  /** When the correction was made */
  correctedAt: Date | null
}
