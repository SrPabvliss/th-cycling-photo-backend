import { DetectedCyclist } from '@classifications/domain/entities'
import type { Prisma, DetectedCyclist as PrismaDetectedCyclist } from '@generated/prisma/client'

/** Converts a domain entity to a Prisma unchecked create input. */
export function toPersistence(entity: DetectedCyclist): Prisma.DetectedCyclistUncheckedCreateInput {
  return {
    id: entity.id,
    photo_id: entity.photoId,
    bounding_box: entity.boundingBox,
    confidence_score: entity.confidenceScore,
    created_at: entity.createdAt,
  }
}

/** Converts a Prisma record to a domain entity. */
export function toEntity(record: PrismaDetectedCyclist): DetectedCyclist {
  return DetectedCyclist.fromPersistence({
    id: record.id,
    photoId: record.photo_id,
    boundingBox: record.bounding_box as Record<string, number>,
    confidenceScore: Number(record.confidence_score),
    createdAt: record.created_at,
  })
}
