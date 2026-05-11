import { EVENT_READ_REPOSITORY, type IEventReadRepository } from '@events/domain/ports'
import { Inject } from '@nestjs/common'
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs'
import { type IOperatorReadRepository, OPERATOR_READ_REPOSITORY } from '../../../domain/ports'
import type { DashboardSummaryProjection } from '../../projections/dashboard-summary.projection'
import { GetDashboardSummaryQuery } from './get-dashboard-summary.query'

@QueryHandler(GetDashboardSummaryQuery)
export class GetDashboardSummaryHandler implements IQueryHandler<GetDashboardSummaryQuery> {
  constructor(
    @Inject(OPERATOR_READ_REPOSITORY)
    private readonly operatorRead: IOperatorReadRepository,
    @Inject(EVENT_READ_REPOSITORY)
    private readonly eventRead: IEventReadRepository,
  ) {}

  async execute(query: GetDashboardSummaryQuery): Promise<DashboardSummaryProjection> {
    const eventIds = await this.eventRead.getAssignedEventIdsByStatus(query.operatorId, 'active')

    const [pendingReviewCount, pendingRetouchCount] = await Promise.all([
      this.operatorRead.countPendingReview(query.operatorId, eventIds),
      this.operatorRead.countPendingRetouch(query.operatorId, eventIds),
    ])

    return {
      pendingReviewCount,
      pendingRetouchCount,
      assignedEventsCount: eventIds.length,
    }
  }
}
