import { Inject, Injectable } from '@nestjs/common'
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs'
import { type IParticipantReadRepository, PARTICIPANT_READ_REPOSITORY } from '../../../domain/ports'
import { GetGearTypesQuery } from './get-gear-types.query'

type GearTypeProjection = { id: number; name: string }

@QueryHandler(GetGearTypesQuery)
@Injectable()
export class GetGearTypesHandler implements IQueryHandler<GetGearTypesQuery> {
  constructor(
    @Inject(PARTICIPANT_READ_REPOSITORY)
    private readonly participantReadRepo: IParticipantReadRepository,
  ) {}

  async execute(query: GetGearTypesQuery): Promise<GearTypeProjection[]> {
    return this.participantReadRepo.getGearTypes(query.eventTypeId)
  }
}
