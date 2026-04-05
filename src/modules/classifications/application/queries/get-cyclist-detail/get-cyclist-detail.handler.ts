import type { ParticipantDetailProjection } from '@classifications/application/projections'
import {
  type IParticipantReadRepository,
  PARTICIPANT_READ_REPOSITORY,
} from '@classifications/domain/ports'
import { Inject } from '@nestjs/common'
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs'
import { AppException } from '@shared/domain'
import { GetParticipantDetailQuery } from './get-cyclist-detail.query'

@QueryHandler(GetParticipantDetailQuery)
export class GetParticipantDetailHandler implements IQueryHandler<GetParticipantDetailQuery> {
  constructor(
    @Inject(PARTICIPANT_READ_REPOSITORY) private readonly readRepo: IParticipantReadRepository,
  ) {}

  async execute(query: GetParticipantDetailQuery): Promise<ParticipantDetailProjection> {
    const participant = await this.readRepo.getParticipantDetail(query.participantId)
    if (!participant) throw AppException.notFound('Participant', query.participantId)
    return participant
  }
}
