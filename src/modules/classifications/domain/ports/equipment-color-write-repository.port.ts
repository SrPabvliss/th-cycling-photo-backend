import type { EquipmentColor } from '../entities'

export interface IEquipmentColorWriteRepository {
  saveMany(colors: EquipmentColor[]): Promise<void>
}

export const EQUIPMENT_COLOR_WRITE_REPOSITORY = Symbol('EQUIPMENT_COLOR_WRITE_REPOSITORY')
