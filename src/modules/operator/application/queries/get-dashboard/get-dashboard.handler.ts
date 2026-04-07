import { ConfigService } from '@nestjs/config'
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs'
import type { OperatorDashboardProjection } from '../../projections'
import { OperatorDashboardService } from '../../services/operator-dashboard.service'
import { GetOperatorDashboardQuery } from './get-dashboard.query'

@QueryHandler(GetOperatorDashboardQuery)
export class GetOperatorDashboardHandler implements IQueryHandler<GetOperatorDashboardQuery> {
  constructor(
    private readonly dashboardService: OperatorDashboardService,
    private readonly config: ConfigService,
  ) {}

  async execute(query: GetOperatorDashboardQuery): Promise<OperatorDashboardProjection> {
    const cdnUrl = this.config.get<string>('CLOUDFLARE_CDN_URL', '')
    return this.dashboardService.getDashboard(query.operatorId, cdnUrl)
  }
}
