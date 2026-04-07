import { Module } from '@nestjs/common'
import { CqrsModule } from '@nestjs/cqrs'
import { GetOperatorDashboardHandler } from './application/queries/get-dashboard/get-dashboard.handler'
import { OperatorDashboardService } from './application/services/operator-dashboard.service'
import { OPERATOR_DASHBOARD_REPOSITORY } from './domain/ports'
import { OperatorDashboardRepository } from './infrastructure/repositories/operator-dashboard.repository'
import { OperatorController } from './presentation/controllers/operator.controller'

@Module({
  imports: [CqrsModule],
  controllers: [OperatorController],
  providers: [
    GetOperatorDashboardHandler,
    OperatorDashboardService,
    { provide: OPERATOR_DASHBOARD_REPOSITORY, useClass: OperatorDashboardRepository },
  ],
})
export class OperatorModule {}
