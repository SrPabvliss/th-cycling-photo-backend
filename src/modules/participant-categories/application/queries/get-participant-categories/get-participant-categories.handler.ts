import { Inject } from '@nestjs/common'
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs'
import {
  type IParticipantCategoryReadRepository,
  PARTICIPANT_CATEGORY_READ_REPOSITORY,
} from '../../../domain/ports'
import type { ParticipantCategoryProjection } from '../../../domain/projections'
import { GetParticipantCategoriesQuery } from './get-participant-categories.query'

@QueryHandler(GetParticipantCategoriesQuery)
export class GetParticipantCategoriesHandler
  implements IQueryHandler<GetParticipantCategoriesQuery>
{
  constructor(
    @Inject(PARTICIPANT_CATEGORY_READ_REPOSITORY)
    private readonly readRepo: IParticipantCategoryReadRepository,
  ) {}

  async execute(query: GetParticipantCategoriesQuery): Promise<ParticipantCategoryProjection[]> {
    return this.readRepo.findByEventType(query.eventTypeId)
  }
}
