import type { EquipmentColorProjection } from './equipment-color.projection'
import type { PlateNumberProjection } from './plate-number.projection'

export class CyclistDetailProjection {
  /** Cyclist UUID */
  id: string
  /** Photo UUID this cyclist belongs to */
  photoId: string
  /** Classification source: 'manual' or 'ai' */
  source: string
  /** Plate number details (null if not detected) */
  plateNumber: PlateNumberProjection | null
  /** Equipment colors associated with this cyclist */
  equipmentColors: EquipmentColorProjection[]
  /** When this cyclist was classified */
  createdAt: Date
  /** When this cyclist was last updated */
  updatedAt: Date
}
