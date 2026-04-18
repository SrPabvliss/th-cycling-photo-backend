import { EVENT_READ_REPOSITORY, type IEventReadRepository } from '@events/domain/ports'
import { Inject } from '@nestjs/common'
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs'
import type { PaginatedResult } from '@shared/application'
import type { PublicEventListProjection } from '../../projections'
import { GetPublicEventsListQuery } from './get-public-events-list.query'

@QueryHandler(GetPublicEventsListQuery)
export class GetPublicEventsListHandler implements IQueryHandler<GetPublicEventsListQuery> {
  constructor(@Inject(EVENT_READ_REPOSITORY) private readonly readRepo: IEventReadRepository) {}

  async execute(
    query: GetPublicEventsListQuery,
  ): Promise<PaginatedResult<PublicEventListProjection>> {
    return this.readRepo.getPublicEventsList(query.pagination)
  }
}
