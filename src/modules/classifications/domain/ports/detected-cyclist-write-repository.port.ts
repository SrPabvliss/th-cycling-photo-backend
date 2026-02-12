import type { DetectedCyclist } from '../entities'

export interface IDetectedCyclistWriteRepository {
  save(cyclist: DetectedCyclist): Promise<DetectedCyclist>
}

export const DETECTED_CYCLIST_WRITE_REPOSITORY = Symbol('DETECTED_CYCLIST_WRITE_REPOSITORY')
