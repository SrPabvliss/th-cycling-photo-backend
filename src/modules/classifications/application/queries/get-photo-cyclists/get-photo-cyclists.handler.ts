import type { ParticipantListProjection } from '@classifications/application/projections'
import {
  type IParticipantReadRepository,
  PARTICIPANT_READ_REPOSITORY,
} from '@classifications/domain/ports'
import { Inject } from '@nestjs/common'
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs'
import { GetPhotoParticipantsQuery } from './get-photo-cyclists.query'

@QueryHandler(GetPhotoParticipantsQuery)
export class GetPhotoParticipantsHandler implements IQueryHandler<GetPhotoParticipantsQuery> {
  constructor(
    @Inject(PARTICIPANT_READ_REPOSITORY) private readonly readRepo: IParticipantReadRepository,
  ) {}

  async execute(query: GetPhotoParticipantsQuery): Promise<ParticipantListProjection[]> {
    return this.readRepo.getParticipantsByPhoto(query.photoId)
  }
}
