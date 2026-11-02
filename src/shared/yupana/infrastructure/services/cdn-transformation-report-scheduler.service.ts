import { InjectQueue } from '@nestjs/bullmq'
import { Inject, Injectable, Logger, type OnModuleInit } from '@nestjs/common'
import type { Queue } from 'bullmq'
import { CDN_TRANSFORMATION_SOURCE, type ICdnTransformationSource } from '../../domain/ports'
import { CDN_TRANSFORMATION_REPORT_QUEUE } from '../processors/cdn-transformation-report.processor'

@Injectable()
export class CdnTransformationReportSchedulerService implements OnModuleInit {
  static readonly SCHEDULER_ID = 'cdn-transformation-report'
  static readonly PATTERN = '0 2 * * *'

  private readonly logger = new Logger(CdnTransformationReportSchedulerService.name)

  constructor(
    @InjectQueue(CDN_TRANSFORMATION_REPORT_QUEUE) private readonly queue: Queue,
    @Inject(CDN_TRANSFORMATION_SOURCE) private readonly source: ICdnTransformationSource,
  ) {}

  async onModuleInit(): Promise<void> {
    if (!this.source.isConfigured()) {
      this.logger.log('Analytics Engine is not configured: CDN transformations are not reported')
      await this.queue.removeJobScheduler(CdnTransformationReportSchedulerService.SCHEDULER_ID)
      return
    }
    await this.queue.upsertJobScheduler(
      CdnTransformationReportSchedulerService.SCHEDULER_ID,
      { pattern: CdnTransformationReportSchedulerService.PATTERN, tz: 'UTC' },
      {
        name: 'report',
        opts: { removeOnComplete: true, removeOnFail: { age: 86400 } },
      },
    )
  }
}
