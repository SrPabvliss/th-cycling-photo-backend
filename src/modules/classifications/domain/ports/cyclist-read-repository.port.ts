import type {
  CyclistDetailProjection,
  CyclistListProjection,
} from '@classifications/application/projections'
import type { DetectedCyclist } from '../entities'

export interface ICyclistReadRepository {
  findById(id: string): Promise<DetectedCyclist | null>
  getCyclistsByPhoto(photoId: string): Promise<CyclistListProjection[]>
  getCyclistDetail(id: string): Promise<CyclistDetailProjection | null>
}

export const CYCLIST_READ_REPOSITORY = Symbol('CYCLIST_READ_REPOSITORY')
