import type {
  ParticipantDetailProjection,
  ParticipantListProjection,
} from '@classifications/application/projections'
import { DetectedParticipant } from '@classifications/domain/entities'
import { GearColor } from '@classifications/domain/entities/gear-color.entity'
import { ParticipantIdentifier } from '@classifications/domain/entities/participant-identifier.entity'
import type { ClassificationSourceType } from '@classifications/domain/value-objects/classification-source.vo'
import {
  Prisma,
  type DetectedParticipant as PrismaDetectedParticipant,
} from '@generated/prisma/client'

// --- Select shapes for Prisma queries ---

export const participantListSelectConfig = {
  id: true,
  photo_id: true,
  source: true,
  identifier: { select: { value: true } },
  _count: { select: { gear_colors: true } },
  created_at: true,
  updated_at: true,
} satisfies Prisma.DetectedParticipantSelect

export type ParticipantListSelect = Prisma.DetectedParticipantGetPayload<{
  select: typeof participantListSelectConfig
}>

export const participantDetailSelectConfig = {
  id: true,
  photo_id: true,
  source: true,
  identifier: {
    select: {
      id: true,
      value: true,
      confidence_score: true,
      manually_corrected: true,
      corrected_at: true,
    },
  },
  gear_colors: {
    select: {
      id: true,
      gear_type_id: true,
      color_name: true,
      color_hex: true,
      raw_hex: true,
      density_percentage: true,
    },
  },
  created_at: true,
  updated_at: true,
} satisfies Prisma.DetectedParticipantSelect

export type ParticipantDetailSelect = Prisma.DetectedParticipantGetPayload<{
  select: typeof participantDetailSelectConfig
}>

export const classificationDetailSelectConfig = {
  detected_participants: { select: participantDetailSelectConfig },
} as const

export type ClassificationDetailSelect = ParticipantDetailSelect

// --- Entity mappers ---

/** Converts a DetectedParticipant entity to Prisma create input. */
export function toParticipantPersistence(
  entity: DetectedParticipant,
): Prisma.DetectedParticipantUncheckedCreateInput {
  return {
    id: entity.id,
    photo_id: entity.photoId,
    source: entity.source,
    created_at: entity.createdAt,
    updated_at: entity.updatedAt,
    created_by_id: entity.createdById,
    classified_by_id: entity.classifiedById,
  }
}

/** Converts a ParticipantIdentifier entity to Prisma create input. */
export function toIdentifierPersistence(
  entity: ParticipantIdentifier,
): Prisma.ParticipantIdentifierUncheckedCreateInput {
  return {
    id: entity.id,
    detected_participant_id: entity.detectedParticipantId,
    value: entity.value,
    confidence_score: entity.confidenceScore,
    manually_corrected: entity.manuallyCorrected,
    corrected_at: entity.correctedAt,
    created_at: entity.createdAt,
    updated_at: entity.updatedAt,
  }
}

/** Converts a GearColor entity to Prisma create input. */
export function toColorPersistence(entity: GearColor): Prisma.GearColorUncheckedCreateInput {
  return {
    id: entity.id,
    detected_participant_id: entity.detectedParticipantId,
    gear_type_id: entity.gearTypeId,
    color_name: entity.colorName,
    color_hex: entity.colorHex,
    raw_hex: entity.rawHex,
    density_percentage: entity.densityPercentage,
    created_at: entity.createdAt,
    updated_at: entity.updatedAt,
  }
}

/** Converts a Prisma record to a DetectedParticipant domain entity. */
export function toEntity(record: PrismaDetectedParticipant): DetectedParticipant {
  return DetectedParticipant.fromPersistence({
    id: record.id,
    photoId: record.photo_id,
    source: record.source as ClassificationSourceType,
    createdAt: record.created_at,
    updatedAt: record.updated_at,
  })
}

/** Converts a Prisma selected record to a list projection. */
export function toListProjection(record: ParticipantListSelect): ParticipantListProjection {
  return {
    id: record.id,
    photoId: record.photo_id,
    source: record.source,
    identifier: record.identifier?.value ?? null,
    colorCount: record._count.gear_colors,
    createdAt: record.created_at,
    updatedAt: record.updated_at,
  }
}

/** Converts a Prisma selected record to a detail projection. */
export function toDetailProjection(record: ParticipantDetailSelect): ParticipantDetailProjection {
  return {
    id: record.id,
    photoId: record.photo_id,
    source: record.source,
    identifier: record.identifier
      ? {
          id: record.identifier.id,
          value: record.identifier.value,
          confidenceScore: record.identifier.confidence_score
            ? Number(record.identifier.confidence_score)
            : null,
          manuallyCorrected: record.identifier.manually_corrected,
          correctedAt: record.identifier.corrected_at,
        }
      : null,
    gearColors: record.gear_colors.map((c) => ({
      id: c.id,
      gearTypeId: c.gear_type_id,
      colorName: c.color_name,
      colorHex: c.color_hex,
      rawHex: c.raw_hex,
      densityPercentage: c.density_percentage ? Number(c.density_percentage) : null,
    })),
    createdAt: record.created_at,
    updatedAt: record.updated_at,
  }
}

/** Converts a ParticipantIdentifier Prisma record to domain entity. */
export function toIdentifierEntity(record: {
  id: string
  detected_participant_id: string
  value: string
  confidence_score: Prisma.Decimal | null
  manually_corrected: boolean
  corrected_at: Date | null
  created_at: Date
  updated_at: Date
}): ParticipantIdentifier {
  return ParticipantIdentifier.fromPersistence({
    id: record.id,
    detectedParticipantId: record.detected_participant_id,
    value: record.value,
    confidenceScore: record.confidence_score ? Number(record.confidence_score) : null,
    manuallyCorrected: record.manually_corrected,
    correctedAt: record.corrected_at,
    createdAt: record.created_at,
    updatedAt: record.updated_at,
  })
}

/** Converts a GearColor Prisma record to domain entity. */
export function toColorEntity(record: {
  id: string
  detected_participant_id: string
  gear_type_id: number
  color_name: string
  color_hex: string
  raw_hex: string | null
  density_percentage: Prisma.Decimal | null
  created_at: Date
  updated_at: Date
}): GearColor {
  return GearColor.fromPersistence({
    id: record.id,
    detectedParticipantId: record.detected_participant_id,
    gearTypeId: record.gear_type_id,
    colorName: record.color_name,
    colorHex: record.color_hex,
    rawHex: record.raw_hex,
    densityPercentage: record.density_percentage ? Number(record.density_percentage) : null,
    createdAt: record.created_at,
    updatedAt: record.updated_at,
  })
}
