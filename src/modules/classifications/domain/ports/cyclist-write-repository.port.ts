import type { DetectedCyclist, EquipmentColor, PlateNumber } from '../entities'

export interface ICyclistWriteRepository {
  saveCyclist(cyclist: DetectedCyclist): Promise<DetectedCyclist>
  savePlateNumber(plate: PlateNumber): Promise<PlateNumber>
  saveColors(colors: EquipmentColor[]): Promise<void>
  deleteColorsByCyclist(cyclistId: string): Promise<void>
  deletePlateNumberByCyclist(cyclistId: string): Promise<void>
  deleteCyclist(id: string): Promise<void>
}

export const CYCLIST_WRITE_REPOSITORY = Symbol('CYCLIST_WRITE_REPOSITORY')
