import { EventListProjection } from '@events/application/projections'
import { EVENT_READ_REPOSITORY, type IEventReadRepository } from '@events/domain/ports'
import { Inject } from '@nestjs/common'
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs'
import { type IPhotoReadRepository, PHOTO_READ_REPOSITORY } from '@photos/domain/ports'
import type { PaginatedResult } from '@shared/application'
import { GetEventsListQuery } from './get-events-list.query'

@QueryHandler(GetEventsListQuery)
export class GetEventsListHandler implements IQueryHandler<GetEventsListQuery> {
  constructor(
    @Inject(EVENT_READ_REPOSITORY) private readonly readRepo: IEventReadRepository,
    @Inject(PHOTO_READ_REPOSITORY) private readonly photoReadRepo: IPhotoReadRepository,
  ) {}

  async execute(query: GetEventsListQuery): Promise<PaginatedResult<EventListProjection>> {
    const result = await this.readRepo.getEventsList(
      query.pagination,
      query.includeArchived,
      query.search,
    )
    if (result.items.length === 0) return result

    const allEventIds = result.items.map((e) => e.id)
    const fileSizes = await this.photoReadRepo.getTotalFileSizesByEventIds(allEventIds)

    for (const event of result.items) {
      event.totalFileSize = fileSizes.get(event.id) ?? 0
    }

    return result
  }
}
