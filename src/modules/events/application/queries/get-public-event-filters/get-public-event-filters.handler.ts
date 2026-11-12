import { EVENT_READ_REPOSITORY, type IEventReadRepository } from '@events/domain/ports'
import { Inject } from '@nestjs/common'
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs'
import type { PublicEventFiltersProjection } from '../../projections'
import { GetPublicEventFiltersQuery } from './get-public-event-filters.query'

@QueryHandler(GetPublicEventFiltersQuery)
export class GetPublicEventFiltersHandler implements IQueryHandler<GetPublicEventFiltersQuery> {
  constructor(@Inject(EVENT_READ_REPOSITORY) private readonly readRepo: IEventReadRepository) {}

  async execute(_query: GetPublicEventFiltersQuery): Promise<PublicEventFiltersProjection> {
    return this.readRepo.getPublicEventFilters()
  }
}
