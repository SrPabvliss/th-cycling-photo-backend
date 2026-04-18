import type { GearColorProjection } from './equipment-color.projection'
import type { IdentifierProjection } from './plate-number.projection'

export class ParticipantDetailProjection {
  /** Participant UUID */
  id: string
  /** Photo UUID this participant belongs to */
  photoId: string
  /** Classification source: 'manual' or 'ai' */
  source: string
  /** Identifier details (null if not detected) */
  identifier: IdentifierProjection | null
  /** Gear colors associated with this participant */
  gearColors: GearColorProjection[]
  /** When this participant was classified */
  createdAt: Date
  /** When this participant was last updated */
  updatedAt: Date
}
