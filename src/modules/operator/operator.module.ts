import { Module } from '@nestjs/common'
import { CqrsModule } from '@nestjs/cqrs'
import { GetOperatorDashboardHandler } from './application/queries/get-dashboard/get-dashboard.handler'
import { GetRetouchQueueHandler } from './application/queries/get-retouch-queue/get-retouch-queue.handler'
import { OperatorDashboardService } from './application/services/operator-dashboard.service'
import { OPERATOR_DASHBOARD_REPOSITORY, OPERATOR_RETOUCH_REPOSITORY } from './domain/ports'
import { OperatorDashboardRepository } from './infrastructure/repositories/operator-dashboard.repository'
import { OperatorRetouchRepository } from './infrastructure/repositories/operator-retouch.repository'
import { OperatorController } from './presentation/controllers/operator.controller'

@Module({
  imports: [CqrsModule],
  controllers: [OperatorController],
  providers: [
    GetOperatorDashboardHandler,
    GetRetouchQueueHandler,
    OperatorDashboardService,
    { provide: OPERATOR_DASHBOARD_REPOSITORY, useClass: OperatorDashboardRepository },
    { provide: OPERATOR_RETOUCH_REPOSITORY, useClass: OperatorRetouchRepository },
  ],
})
export class OperatorModule {}
