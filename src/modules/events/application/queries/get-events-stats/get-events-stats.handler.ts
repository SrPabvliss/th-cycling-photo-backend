import { EventsStatsProjection } from '@events/application/projections'
import { EVENT_READ_REPOSITORY, type IEventReadRepository } from '@events/domain/ports'
import { Inject } from '@nestjs/common'
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs'
import { type IPhotoReadRepository, PHOTO_READ_REPOSITORY } from '@photos/domain/ports'
import {
  AUTHORIZATION_SERVICE,
  type IAuthorizationService,
} from '@shared/authorization/domain/ports/authorization.service.port'
import { GetEventsStatsQuery } from './get-events-stats.query'

@QueryHandler(GetEventsStatsQuery)
export class GetEventsStatsHandler implements IQueryHandler<GetEventsStatsQuery> {
  constructor(
    @Inject(EVENT_READ_REPOSITORY) private readonly eventReadRepo: IEventReadRepository,
    @Inject(PHOTO_READ_REPOSITORY) private readonly photoReadRepo: IPhotoReadRepository,
    @Inject(AUTHORIZATION_SERVICE) private readonly authz: IAuthorizationService,
  ) {}

  /**
   * Returns aggregates across events in the caller's scope (including
   * archived). All three aggregates — `totalEvents`, `totalPhotos`, and
   * `totalStorageBytes` — are scoped to the same `EventScope`, closing the
   * cross-tenant leak where a tenant's own event count was shown beside
   * every tenant's photo count and total storage (Ruling 20).
   */
  async execute(query: GetEventsStatsQuery): Promise<EventsStatsProjection> {
    const scope = await this.authz.resolveEventScope(query.userId)

    const [totalEvents, totalPhotos, totalStorageBytes] = await Promise.all([
      this.eventReadRepo.countAll(scope),
      this.photoReadRepo.countAll(scope),
      this.photoReadRepo.sumAllFileSize(scope),
    ])

    return { totalEvents, totalPhotos, totalStorageBytes }
  }
}
