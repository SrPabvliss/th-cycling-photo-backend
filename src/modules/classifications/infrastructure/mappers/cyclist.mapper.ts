import type {
  CyclistDetailProjection,
  CyclistListProjection,
} from '@classifications/application/projections'
import { DetectedCyclist } from '@classifications/domain/entities'
import { EquipmentColor } from '@classifications/domain/entities/equipment-color.entity'
import { PlateNumber } from '@classifications/domain/entities/plate-number.entity'
import type { ClassificationSourceType } from '@classifications/domain/value-objects/classification-source.vo'
import type { EquipmentItemType } from '@classifications/domain/value-objects/equipment-item.vo'
import type { Prisma, DetectedCyclist as PrismaDetectedCyclist } from '@generated/prisma/client'
import type { CyclistDetailSelect, CyclistListSelect } from '../constants'

/** Converts a DetectedCyclist entity to Prisma create input. */
export function toCyclistPersistence(
  entity: DetectedCyclist,
): Prisma.DetectedCyclistUncheckedCreateInput {
  return {
    id: entity.id,
    photo_id: entity.photoId,
    source: entity.source,
    created_at: entity.createdAt,
    updated_at: entity.updatedAt,
  }
}

/** Converts a PlateNumber entity to Prisma create input. */
export function toPlatePersistence(entity: PlateNumber): Prisma.PlateNumberUncheckedCreateInput {
  return {
    id: entity.id,
    detected_cyclist_id: entity.detectedCyclistId,
    number: entity.number,
    confidence_score: entity.confidenceScore,
    manually_corrected: entity.manuallyCorrected,
    corrected_at: entity.correctedAt,
    created_at: entity.createdAt,
    updated_at: entity.updatedAt,
  }
}

/** Converts an EquipmentColor entity to Prisma create input. */
export function toColorPersistence(
  entity: EquipmentColor,
): Prisma.EquipmentColorUncheckedCreateInput {
  return {
    id: entity.id,
    detected_cyclist_id: entity.detectedCyclistId,
    item_type: entity.itemType,
    color_name: entity.colorName,
    color_hex: entity.colorHex,
    raw_hex: entity.rawHex,
    density_percentage: entity.densityPercentage,
    created_at: entity.createdAt,
    updated_at: entity.updatedAt,
  }
}

/** Converts a Prisma record to a DetectedCyclist domain entity. */
export function toEntity(record: PrismaDetectedCyclist): DetectedCyclist {
  return DetectedCyclist.fromPersistence({
    id: record.id,
    photoId: record.photo_id,
    source: record.source as ClassificationSourceType,
    createdAt: record.created_at,
    updatedAt: record.updated_at,
  })
}

/** Converts a Prisma selected record to a list projection. */
export function toListProjection(record: CyclistListSelect): CyclistListProjection {
  return {
    id: record.id,
    photoId: record.photo_id,
    source: record.source,
    plateNumber: record.plate_number?.number ?? null,
    colorCount: record._count.equipment_colors,
    createdAt: record.created_at,
    updatedAt: record.updated_at,
  }
}

/** Converts a Prisma selected record to a detail projection. */
export function toDetailProjection(record: CyclistDetailSelect): CyclistDetailProjection {
  return {
    id: record.id,
    photoId: record.photo_id,
    source: record.source,
    plateNumber: record.plate_number
      ? {
          id: record.plate_number.id,
          number: record.plate_number.number,
          confidenceScore: record.plate_number.confidence_score
            ? Number(record.plate_number.confidence_score)
            : null,
          manuallyCorrected: record.plate_number.manually_corrected,
          correctedAt: record.plate_number.corrected_at,
        }
      : null,
    equipmentColors: record.equipment_colors.map((c) => ({
      id: c.id,
      itemType: c.item_type,
      colorName: c.color_name,
      colorHex: c.color_hex,
      rawHex: c.raw_hex,
      densityPercentage: c.density_percentage ? Number(c.density_percentage) : null,
    })),
    createdAt: record.created_at,
    updatedAt: record.updated_at,
  }
}

/** Converts a PlateNumber Prisma record to domain entity. */
export function toPlateEntity(record: {
  id: string
  detected_cyclist_id: string
  number: number
  confidence_score: Prisma.Decimal | null
  manually_corrected: boolean
  corrected_at: Date | null
  created_at: Date
  updated_at: Date
}): PlateNumber {
  return PlateNumber.fromPersistence({
    id: record.id,
    detectedCyclistId: record.detected_cyclist_id,
    number: record.number,
    confidenceScore: record.confidence_score ? Number(record.confidence_score) : null,
    manuallyCorrected: record.manually_corrected,
    correctedAt: record.corrected_at,
    createdAt: record.created_at,
    updatedAt: record.updated_at,
  })
}

/** Converts an EquipmentColor Prisma record to domain entity. */
export function toColorEntity(record: {
  id: string
  detected_cyclist_id: string
  item_type: string
  color_name: string
  color_hex: string
  raw_hex: string | null
  density_percentage: Prisma.Decimal | null
  created_at: Date
  updated_at: Date
}): EquipmentColor {
  return EquipmentColor.fromPersistence({
    id: record.id,
    detectedCyclistId: record.detected_cyclist_id,
    itemType: record.item_type as EquipmentItemType,
    colorName: record.color_name,
    colorHex: record.color_hex,
    rawHex: record.raw_hex,
    densityPercentage: record.density_percentage ? Number(record.density_percentage) : null,
    createdAt: record.created_at,
    updatedAt: record.updated_at,
  })
}
