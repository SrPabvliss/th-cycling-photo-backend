import type { ParticipantCategoryProjection } from '../projections'

export const PARTICIPANT_CATEGORY_READ_REPOSITORY = Symbol('PARTICIPANT_CATEGORY_READ_REPOSITORY')

export interface IParticipantCategoryReadRepository {
  /** Returns participant categories filtered by event type, sorted by name. */
  findByEventType(eventTypeId: number): Promise<ParticipantCategoryProjection[]>
}
