import { PlateNumber } from '@classifications/domain/entities'
import type { Prisma, PlateNumber as PrismaPlateNumber } from '@generated/prisma/client'

/** Converts a domain entity to a Prisma unchecked create input. */
export function toPersistence(entity: PlateNumber): Prisma.PlateNumberUncheckedCreateInput {
  return {
    id: entity.id,
    detected_cyclist_id: entity.detectedCyclistId,
    number: entity.number,
    confidence_score: entity.confidenceScore,
    manually_corrected: entity.manuallyCorrected,
    corrected_at: entity.correctedAt,
    created_at: entity.createdAt,
  }
}

/** Converts a Prisma record to a domain entity. */
export function toEntity(record: PrismaPlateNumber): PlateNumber {
  return PlateNumber.fromPersistence({
    id: record.id,
    detectedCyclistId: record.detected_cyclist_id,
    number: record.number,
    confidenceScore: record.confidence_score ? Number(record.confidence_score) : null,
    manuallyCorrected: record.manually_corrected,
    correctedAt: record.corrected_at,
    createdAt: record.created_at,
  })
}
