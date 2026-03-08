import { EventsStatsProjection } from '@events/application/projections'
import { EVENT_READ_REPOSITORY, type IEventReadRepository } from '@events/domain/ports'
import { Inject } from '@nestjs/common'
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs'
import { type IPhotoReadRepository, PHOTO_READ_REPOSITORY } from '@photos/domain/ports'
import { GetEventsStatsQuery } from './get-events-stats.query'

@QueryHandler(GetEventsStatsQuery)
export class GetEventsStatsHandler implements IQueryHandler<GetEventsStatsQuery> {
  constructor(
    @Inject(EVENT_READ_REPOSITORY) private readonly eventReadRepo: IEventReadRepository,
    @Inject(PHOTO_READ_REPOSITORY) private readonly photoReadRepo: IPhotoReadRepository,
  ) {}

  /** Returns global aggregates across all events (including archived). */
  async execute(_query: GetEventsStatsQuery): Promise<EventsStatsProjection> {
    const [totalEvents, totalPhotos, totalStorageBytes] = await Promise.all([
      this.eventReadRepo.countAll(),
      this.photoReadRepo.countAll(),
      this.photoReadRepo.sumAllFileSize(),
    ])

    return { totalEvents, totalPhotos, totalStorageBytes }
  }
}
