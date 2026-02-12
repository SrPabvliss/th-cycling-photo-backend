import { EquipmentColor } from '@classifications/domain/entities'
import type { EquipmentItemType } from '@classifications/domain/value-objects/equipment-item.vo'
import type { Prisma, EquipmentColor as PrismaEquipmentColor } from '@generated/prisma/client'

/** Converts a domain entity to a Prisma unchecked create input. */
export function toPersistence(entity: EquipmentColor): Prisma.EquipmentColorUncheckedCreateInput {
  return {
    id: entity.id,
    detected_cyclist_id: entity.detectedCyclistId,
    item_type: entity.itemType,
    color_name: entity.colorName,
    color_hex: entity.colorHex,
    density_percentage: entity.densityPercentage,
    created_at: entity.createdAt,
  }
}

/** Converts a Prisma record to a domain entity. */
export function toEntity(record: PrismaEquipmentColor): EquipmentColor {
  return EquipmentColor.fromPersistence({
    id: record.id,
    detectedCyclistId: record.detected_cyclist_id,
    itemType: record.item_type as EquipmentItemType,
    colorName: record.color_name,
    colorHex: record.color_hex,
    densityPercentage: Number(record.density_percentage),
    createdAt: record.created_at,
  })
}
