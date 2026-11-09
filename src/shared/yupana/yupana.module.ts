import { BullModule } from '@nestjs/bullmq'
import { Global, Module } from '@nestjs/common'
import {
  CDN_RETIRED_SLUG_REPOSITORY,
  CDN_TRANSFORMATION_REPOSITORY,
  CDN_TRANSFORMATION_SOURCE,
  YUPANA_CLIENT,
  YUPANA_OUTBOX_REPOSITORY,
  YUPANA_PHOTO_DECLARER,
} from './domain/ports'
import { AnalyticsEngineCdnTransformationSource } from './infrastructure/adapters/analytics-engine-cdn-transformation.source'
import { YupanaHttpClient } from './infrastructure/adapters/yupana-http.client'
import {
  CDN_TRANSFORMATION_REPORT_QUEUE,
  CdnTransformationReportProcessor,
} from './infrastructure/processors/cdn-transformation-report.processor'
import {
  YUPANA_DELIVERY_QUEUE,
  YupanaDeliveryProcessor,
} from './infrastructure/processors/yupana-delivery.processor'
import { CdnRetiredSlugRepository } from './infrastructure/repositories/cdn-retired-slug.repository'
import { CdnTransformationRepository } from './infrastructure/repositories/cdn-transformation.repository'
import { YupanaOutboxRepository } from './infrastructure/repositories/yupana-outbox.repository'
import { CdnTransformationReportSchedulerService } from './infrastructure/services/cdn-transformation-report-scheduler.service'
import { CdnTransformationReporterService } from './infrastructure/services/cdn-transformation-reporter.service'
import { YupanaDeliverySchedulerService } from './infrastructure/services/yupana-delivery-scheduler.service'
import { YupanaPhotoDeclarerService } from './infrastructure/services/yupana-photo-declarer.service'

@Global()
@Module({
  imports: [
    BullModule.registerQueue({ name: YUPANA_DELIVERY_QUEUE }),
    BullModule.registerQueue({ name: CDN_TRANSFORMATION_REPORT_QUEUE }),
  ],
  providers: [
    { provide: YUPANA_OUTBOX_REPOSITORY, useClass: YupanaOutboxRepository },
    { provide: YUPANA_CLIENT, useClass: YupanaHttpClient },
    { provide: YUPANA_PHOTO_DECLARER, useClass: YupanaPhotoDeclarerService },
    { provide: CDN_RETIRED_SLUG_REPOSITORY, useClass: CdnRetiredSlugRepository },
    { provide: CDN_TRANSFORMATION_REPOSITORY, useClass: CdnTransformationRepository },
    { provide: CDN_TRANSFORMATION_SOURCE, useClass: AnalyticsEngineCdnTransformationSource },
    CdnTransformationReporterService,
    CdnTransformationReportProcessor,
    CdnTransformationReportSchedulerService,
    YupanaDeliveryProcessor,
    YupanaDeliverySchedulerService,
  ],
  exports: [
    YUPANA_OUTBOX_REPOSITORY,
    YUPANA_CLIENT,
    YUPANA_PHOTO_DECLARER,
    CDN_RETIRED_SLUG_REPOSITORY,
    CdnTransformationReporterService,
  ],
})
export class YupanaModule {}
