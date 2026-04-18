import type { ClassificationDetailSelect } from './cyclist.mapper'
import { toDetailProjection } from './cyclist.mapper'

/**
 * Maps a nested detected_participant Prisma record (inside a Photo query)
 * to a DetectedParticipantProjection.
 * Re-exports the participant detail mapper for use by the photos module.
 */
export function toDetectedParticipantProjection(record: ClassificationDetailSelect) {
  return toDetailProjection(record)
}
