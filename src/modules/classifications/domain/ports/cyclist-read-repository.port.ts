import type {
  ParticipantDetailProjection,
  ParticipantListProjection,
} from '@classifications/application/projections'
import type { DetectedParticipant } from '../entities'

export interface IParticipantReadRepository {
  findById(id: string): Promise<DetectedParticipant | null>
  getParticipantsByPhoto(photoId: string): Promise<ParticipantListProjection[]>
  getParticipantDetail(id: string): Promise<ParticipantDetailProjection | null>
  getParticipantCategories(eventTypeId: number): Promise<Array<{ id: number; name: string }>>
  getGearTypes(eventTypeId: number): Promise<Array<{ id: number; name: string }>>
}

export const PARTICIPANT_READ_REPOSITORY = Symbol('PARTICIPANT_READ_REPOSITORY')
