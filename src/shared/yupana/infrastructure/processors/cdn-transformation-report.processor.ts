import { Processor, WorkerHost } from '@nestjs/bullmq'
import { CdnTransformationReporterService } from '../services/cdn-transformation-reporter.service'

export const CDN_TRANSFORMATION_REPORT_QUEUE = 'cdn-transformation-report'

@Processor(CDN_TRANSFORMATION_REPORT_QUEUE, { concurrency: 1 })
export class CdnTransformationReportProcessor extends WorkerHost {
  constructor(private readonly reporter: CdnTransformationReporterService) {
    super()
  }

  async process(): Promise<void> {
    await this.reporter.report(new Date())
  }
}
