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
   * archived). `totalPhotos`/`totalStorageBytes` remain platform-wide for
   * now — scoping the photo aggregates is Task 11's job once Photo gains
   * its own scope threading.
   */
  async execute(query: GetEventsStatsQuery): Promise<EventsStatsProjection> {
    const scope = await this.authz.resolveEventScope(query.userId)

    const [totalEvents, totalPhotos, totalStorageBytes] = await Promise.all([
      this.eventReadRepo.countAll(scope),
      this.photoReadRepo.countAll(),
      this.photoReadRepo.sumAllFileSize(),
    ])

    return { totalEvents, totalPhotos, totalStorageBytes }
  }
}
