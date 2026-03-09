import type { EquipmentItemType } from '../value-objects/equipment-item.vo'

export class EquipmentColor {
  constructor(
    public readonly id: string,
    public readonly detectedCyclistId: string,
    public itemType: EquipmentItemType,
    public colorName: string,
    public colorHex: string,
    public rawHex: string | null,
    public densityPercentage: number | null,
    public readonly createdAt: Date,
    public updatedAt: Date,
  ) {}

  static create(data: {
    detectedCyclistId: string
    itemType: EquipmentItemType
    colorName: string
    colorHex: string
  }): EquipmentColor {
    const now = new Date()
    return new EquipmentColor(
      crypto.randomUUID(),
      data.detectedCyclistId,
      data.itemType,
      data.colorName,
      data.colorHex,
      null,
      null,
      now,
      now,
    )
  }

  static fromPersistence(data: {
    id: string
    detectedCyclistId: string
    itemType: EquipmentItemType
    colorName: string
    colorHex: string
    rawHex: string | null
    densityPercentage: number | null
    createdAt: Date
    updatedAt: Date
  }): EquipmentColor {
    return new EquipmentColor(
      data.id,
      data.detectedCyclistId,
      data.itemType,
      data.colorName,
      data.colorHex,
      data.rawHex,
      data.densityPercentage,
      data.createdAt,
      data.updatedAt,
    )
  }
}
