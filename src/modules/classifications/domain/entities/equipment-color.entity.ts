import { AppException } from '@shared/domain'
import type { EquipmentItemType } from '../value-objects/equipment-item.vo'

export class EquipmentColor {
  constructor(
    public readonly id: string,
    public readonly detectedCyclistId: string,
    public readonly itemType: EquipmentItemType,
    public readonly colorName: string,
    public readonly colorHex: string,
    public readonly densityPercentage: number,
    public readonly createdAt: Date,
  ) {}

  static create(data: {
    detectedCyclistId: string
    itemType: EquipmentItemType
    colorName: string
    colorHex: string
    densityPercentage: number
  }): EquipmentColor {
    EquipmentColor.validateDensityPercentage(data.densityPercentage)

    return new EquipmentColor(
      crypto.randomUUID(),
      data.detectedCyclistId,
      data.itemType,
      data.colorName,
      data.colorHex,
      data.densityPercentage,
      new Date(),
    )
  }

  private static validateDensityPercentage(value: number): void {
    if (value < 0 || value > 100) {
      throw AppException.businessRule('photo.density_percentage_out_of_range')
    }
  }

  static fromPersistence(data: {
    id: string
    detectedCyclistId: string
    itemType: EquipmentItemType
    colorName: string
    colorHex: string
    densityPercentage: number
    createdAt: Date
  }): EquipmentColor {
    return new EquipmentColor(
      data.id,
      data.detectedCyclistId,
      data.itemType,
      data.colorName,
      data.colorHex,
      data.densityPercentage,
      data.createdAt,
    )
  }
}
