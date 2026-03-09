import type { CyclistListProjection } from '@classifications/application/projections'
import { CYCLIST_READ_REPOSITORY, type ICyclistReadRepository } from '@classifications/domain/ports'
import { Inject } from '@nestjs/common'
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs'
import { GetPhotoCyclistsQuery } from './get-photo-cyclists.query'

@QueryHandler(GetPhotoCyclistsQuery)
export class GetPhotoCyclistsHandler implements IQueryHandler<GetPhotoCyclistsQuery> {
  constructor(@Inject(CYCLIST_READ_REPOSITORY) private readonly readRepo: ICyclistReadRepository) {}

  async execute(query: GetPhotoCyclistsQuery): Promise<CyclistListProjection[]> {
    return this.readRepo.getCyclistsByPhoto(query.photoId)
  }
}
