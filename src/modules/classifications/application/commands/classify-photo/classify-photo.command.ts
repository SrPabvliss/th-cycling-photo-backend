import type { EquipmentItemType } from '@classifications/domain/value-objects/equipment-item.vo'

export interface PlateClassification {
  number: number
  confidenceScore?: number
}

export interface ColorClassification {
  itemType: EquipmentItemType
  colorName: string
  colorHex: string
  densityPercentage: number
}

export interface CyclistClassification {
  boundingBox: Record<string, number>
  confidenceScore: number
  plateNumber?: PlateClassification
  colors?: ColorClassification[]
}

export class ClassifyPhotoCommand {
  constructor(
    public readonly photoId: string,
    public readonly cyclists: CyclistClassification[],
  ) {}
}
