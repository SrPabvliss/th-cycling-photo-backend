import type { DetectedCyclistProjection } from '@classifications/application/projections'
import type { ClassificationDetailSelect } from '@classifications/infrastructure/constants'

/** Maps a Prisma detected_cyclist select result to a DetectedCyclistProjection. */
export function toDetectedCyclistProjection(
  record: ClassificationDetailSelect,
): DetectedCyclistProjection {
  return {
    id: record.id,
    boundingBox: record.bounding_box as object,
    confidenceScore: Number(record.confidence_score),
    plateNumber: record.plate_number
      ? {
          number: record.plate_number.number,
          confidenceScore: record.plate_number.confidence_score
            ? Number(record.plate_number.confidence_score)
            : null,
          manuallyCorrected: record.plate_number.manually_corrected,
        }
      : null,
    equipmentColors: record.equipment_colors.map((color) => ({
      itemType: color.item_type,
      colorName: color.color_name,
      colorHex: color.color_hex,
      densityPercentage: Number(color.density_percentage),
    })),
  }
}
