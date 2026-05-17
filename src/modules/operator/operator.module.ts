import { EventsModule } from '@events/events.module'
import { Module } from '@nestjs/common'
import { CqrsModule } from '@nestjs/cqrs'
import { PhotosModule } from '@photos/photos.module'
import { CloudflareModule } from '@shared/cloudflare/cloudflare.module'
import { GetActiveEventsHandler } from './application/queries/get-active-events/get-active-events.handler'
import { GetCompletedEventsHandler } from './application/queries/get-completed-events/get-completed-events.handler'
import { GetDashboardSummaryHandler } from './application/queries/get-dashboard-summary/get-dashboard-summary.handler'
import { GetOperatorRetouchOrderDetailHandler } from './application/queries/get-operator-retouch-order-detail/get-operator-retouch-order-detail.handler'
import { GetOperatorRetouchOrdersHandler } from './application/queries/get-operator-retouch-orders/get-operator-retouch-orders.handler'
import { GetRecentActivityHandler } from './application/queries/get-recent-activity/get-recent-activity.handler'
import { GetRetouchQueueHandler } from './application/queries/get-retouch-queue/get-retouch-queue.handler'
import { GetOperatorReviewQueueHandler } from './application/queries/get-review-queue/get-review-queue.handler'
import { OPERATOR_READ_REPOSITORY, OPERATOR_RETOUCH_READ_REPOSITORY } from './domain/ports'
import { OperatorReadRepository } from './infrastructure/repositories/operator-read.repository'
import { OperatorRetouchReadRepository } from './infrastructure/repositories/operator-retouch-read.repository'
import { OperatorController } from './presentation/controllers/operator.controller'

@Module({
  imports: [CqrsModule, EventsModule, PhotosModule, CloudflareModule],
  controllers: [OperatorController],
  providers: [
    GetDashboardSummaryHandler,
    GetOperatorRetouchOrderDetailHandler,
    GetActiveEventsHandler,
    GetCompletedEventsHandler,
    GetRecentActivityHandler,
    GetOperatorRetouchOrdersHandler,
    GetRetouchQueueHandler,
    GetOperatorReviewQueueHandler,
    { provide: OPERATOR_READ_REPOSITORY, useClass: OperatorReadRepository },
    { provide: OPERATOR_RETOUCH_READ_REPOSITORY, useClass: OperatorRetouchReadRepository },
  ],
})
export class OperatorModule {}
