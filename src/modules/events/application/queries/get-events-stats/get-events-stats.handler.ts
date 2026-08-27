import { EventsStatsProjection } from '@events/application/projections'
import { EVENT_READ_REPOSITORY, type IEventReadRepository } from '@events/domain/ports'
import { Inject } from '@nestjs/common'
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs'
import {
  AUTHORIZATION_SERVICE,
  type IAuthorizationService,
} from '@shared/authorization/domain/ports/authorization.service.port'
import { GetEventsStatsQuery } from './get-events-stats.query'

@QueryHandler(GetEventsStatsQuery)
export class GetEventsStatsHandler implements IQueryHandler<GetEventsStatsQuery> {
  constructor(
    @Inject(EVENT_READ_REPOSITORY) private readonly eventReadRepo: IEventReadRepository,
    @Inject(AUTHORIZATION_SERVICE) private readonly authz: IAuthorizationService,
  ) {}

  /**
   * Every figure is aggregated in the database against the same `EventScope` — previously a
   * tenant's own event count sat beside every tenant's photo count. `tab` is ignored: the tabs
   * partition the same population `search`/`organizerId` narrow, so picking one must not move
   * the tiles.
   */
  async execute(query: GetEventsStatsQuery): Promise<EventsStatsProjection> {
    const scope = await this.authz.resolveEventScope(query.userId)
    return this.eventReadRepo.getEventsStats(query.filters, scope)
  }
}
