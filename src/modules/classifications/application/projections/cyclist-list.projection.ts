export class ParticipantListProjection {
  /** Participant UUID */
  id: string
  /** Photo UUID this participant belongs to */
  photoId: string
  /** Classification source: 'manual' or 'ai' */
  source: string
  /** Identifier value (if detected) */
  identifier: string | null
  /** Number of colors associated with this participant */
  colorCount: number
  /** When this participant was classified */
  createdAt: Date
  /** When this participant was last updated */
  updatedAt: Date
}
