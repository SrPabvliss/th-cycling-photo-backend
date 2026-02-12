import { EquipmentColorProjection } from './equipment-color.projection'
import { PlateNumberProjection } from './plate-number.projection'

export class DetectedCyclistProjection {
  /** Cyclist detection UUID */
  id: string
  /** Bounding box coordinates from object detection */
  boundingBox: object
  /** Detection confidence score (0-1) */
  confidenceScore: number
  /** Detected plate number, if any */
  plateNumber: PlateNumberProjection | null
  /** Detected equipment colors */
  equipmentColors: EquipmentColorProjection[]
}
