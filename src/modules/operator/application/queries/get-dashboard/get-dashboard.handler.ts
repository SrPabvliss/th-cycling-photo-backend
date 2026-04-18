import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs'
import type { OperatorDashboardProjection } from '../../projections'
import { OperatorDashboardService } from '../../services/operator-dashboard.service'
import { GetOperatorDashboardQuery } from './get-dashboard.query'

@QueryHandler(GetOperatorDashboardQuery)
export class GetOperatorDashboardHandler implements IQueryHandler<GetOperatorDashboardQuery> {
  constructor(private readonly dashboardService: OperatorDashboardService) {}

  async execute(query: GetOperatorDashboardQuery): Promise<OperatorDashboardProjection> {
    return this.dashboardService.getDashboard(query.operatorId)
  }
}
