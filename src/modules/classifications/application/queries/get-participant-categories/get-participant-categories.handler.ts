import { Inject, Injectable } from '@nestjs/common'
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs'
import { type IParticipantReadRepository, PARTICIPANT_READ_REPOSITORY } from '../../../domain/ports'
import { GetParticipantCategoriesQuery } from './get-participant-categories.query'

type ParticipantCategoryProjection = { id: number; name: string }

@QueryHandler(GetParticipantCategoriesQuery)
@Injectable()
export class GetParticipantCategoriesHandler
  implements IQueryHandler<GetParticipantCategoriesQuery>
{
  constructor(
    @Inject(PARTICIPANT_READ_REPOSITORY)
    private readonly participantReadRepo: IParticipantReadRepository,
  ) {}

  async execute(query: GetParticipantCategoriesQuery): Promise<ParticipantCategoryProjection[]> {
    return this.participantReadRepo.getParticipantCategories(query.eventTypeId)
  }
}
