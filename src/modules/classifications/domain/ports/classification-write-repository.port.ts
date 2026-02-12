import type { Photo } from '@photos/domain/entities'
import type { DetectedCyclist, EquipmentColor, PlateNumber } from '../entities'

export interface ClassificationData {
  cyclist: DetectedCyclist
  plate: PlateNumber | null
  colors: EquipmentColor[]
}

export interface IClassificationWriteRepository {
  saveClassification(photo: Photo, classifications: ClassificationData[]): Promise<void>
}

export const CLASSIFICATION_WRITE_REPOSITORY = Symbol('CLASSIFICATION_WRITE_REPOSITORY')
