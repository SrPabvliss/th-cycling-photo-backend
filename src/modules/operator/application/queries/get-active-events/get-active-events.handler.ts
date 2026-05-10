import { EVENT_READ_REPOSITORY, type IEventReadRepository } from '@events/domain/ports'
import { Inject } from '@nestjs/common'
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs'
import { PaginatedResult } from '@shared/application'
import { type IOperatorReadRepository, OPERATOR_READ_REPOSITORY } from '../../../domain/ports'
import type { OperatorActiveEventProjection } from '../../projections/operator-active-event.projection'
import { GetActiveEventsQuery } from './get-active-events.query'

@QueryHandler(GetActiveEventsQuery)
export class GetActiveEventsHandler implements IQueryHandler<GetActiveEventsQuery> {
  constructor(
    @Inject(EVENT_READ_REPOSITORY)
    private readonly eventRead: IEventReadRepository,
    @Inject(OPERATOR_READ_REPOSITORY)
    private readonly operatorRead: IOperatorReadRepository,
  ) {}

  async execute(
    query: GetActiveEventsQuery,
  ): Promise<PaginatedResult<OperatorActiveEventProjection>> {
    const events = await this.eventRead.getAssignedEventsByStatus(
      query.operatorId,
      'active',
      query.pagination,
    )

    if (events.items.length === 0) {
      return new PaginatedResult([], events.total, query.pagination)
    }

    const eventIds = events.items.map((e) => e.id)
    const stats = await this.operatorRead.getActiveEventStats(eventIds)

    const composed: OperatorActiveEventProjection[] = events.items.map((event) => {
      const s = stats.get(event.id)
      return {
        event,
        stats: {
          review: {
            pendingPhotos: s?.pendingPhotos ?? 0,
            totalProcessedPhotos: s?.totalProcessedPhotos ?? 0,
          },
          retouch: {
            pendingPhotos: s?.retouchPendingPhotos ?? 0,
          },
        },
      }
    })

    return new PaginatedResult(composed, events.total, query.pagination)
  }
}
