import { EVENT_READ_REPOSITORY, type IEventReadRepository } from '@events/domain/ports'
import { Inject } from '@nestjs/common'
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs'
import { PaginatedResult } from '@shared/application'
import { type IOperatorReadRepository, OPERATOR_READ_REPOSITORY } from '../../../domain/ports'
import type { OperatorCompletedEventProjection } from '../../projections/operator-completed-event.projection'
import { GetCompletedEventsQuery } from './get-completed-events.query'

@QueryHandler(GetCompletedEventsQuery)
export class GetCompletedEventsHandler implements IQueryHandler<GetCompletedEventsQuery> {
  constructor(
    @Inject(EVENT_READ_REPOSITORY)
    private readonly eventRead: IEventReadRepository,
    @Inject(OPERATOR_READ_REPOSITORY)
    private readonly operatorRead: IOperatorReadRepository,
  ) {}

  async execute(
    query: GetCompletedEventsQuery,
  ): Promise<PaginatedResult<OperatorCompletedEventProjection>> {
    const events = await this.eventRead.getAssignedEventsByStatus(
      query.operatorId,
      'completed',
      query.pagination,
    )

    if (events.items.length === 0) {
      return new PaginatedResult([], events.total, query.pagination)
    }

    const eventIds = events.items.map((e) => e.id)
    const stats = await this.operatorRead.getCompletedEventStats(eventIds)

    const composed: OperatorCompletedEventProjection[] = events.items.map((event) => {
      const s = stats.get(event.id)
      return {
        event,
        stats: {
          totalRetouched: s?.totalRetouched ?? 0,
          completedAt: s?.completedAt ? s.completedAt.toISOString() : null,
        },
      }
    })

    return new PaginatedResult(composed, events.total, query.pagination)
  }
}
