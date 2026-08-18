import { EventListProjection } from '@events/application/projections'
import { EVENT_READ_REPOSITORY, type IEventReadRepository } from '@events/domain/ports'
import { Inject } from '@nestjs/common'
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs'
import { type IPhotoReadRepository, PHOTO_READ_REPOSITORY } from '@photos/domain/ports'
import type { PaginatedResult } from '@shared/application'
import {
  AUTHORIZATION_SERVICE,
  type IAuthorizationService,
} from '@shared/authorization/domain/ports/authorization.service.port'
import { GetEventsListQuery } from './get-events-list.query'

@QueryHandler(GetEventsListQuery)
export class GetEventsListHandler implements IQueryHandler<GetEventsListQuery> {
  constructor(
    @Inject(EVENT_READ_REPOSITORY) private readonly readRepo: IEventReadRepository,
    @Inject(PHOTO_READ_REPOSITORY) private readonly photoReadRepo: IPhotoReadRepository,
    @Inject(AUTHORIZATION_SERVICE) private readonly authz: IAuthorizationService,
  ) {}

  async execute(query: GetEventsListQuery): Promise<PaginatedResult<EventListProjection>> {
    const scope = await this.authz.resolveEventScope(query.userId)

    const result = await this.readRepo.getEventsList(
      query.pagination,
      query.includeArchived,
      query.search,
      scope,
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
