import type { ClassificationDetailSelect } from '../constants'
import { toDetailProjection } from './cyclist.mapper'

/**
 * Maps a nested detected_cyclist Prisma record (inside a Photo query)
 * to a DetectedCyclistProjection.
 * Re-exports the cyclist detail mapper for use by the photos module.
 */
export function toDetectedCyclistProjection(record: ClassificationDetailSelect) {
  return toDetailProjection(record)
}
