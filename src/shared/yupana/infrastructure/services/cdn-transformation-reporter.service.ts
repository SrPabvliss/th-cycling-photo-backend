import { Inject, Injectable, Logger } from '@nestjs/common'
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service'
import { CdnTransformationDay } from '../../domain/cdn-transformation-day'
import {
  CDN_TRANSFORMATION_REPOSITORY,
  CDN_TRANSFORMATION_SOURCE,
  type ICdnTransformationRepository,
  type ICdnTransformationSource,
  type IYupanaOutboxRepository,
  YUPANA_OUTBOX_REPOSITORY,
} from '../../domain/ports'

export interface CdnTransformationReportRun {
  processedDays: string[]
}

@Injectable()
export class CdnTransformationReporterService {
  private readonly logger = new Logger(CdnTransformationReporterService.name)

  constructor(
    @Inject(CDN_TRANSFORMATION_SOURCE) private readonly source: ICdnTransformationSource,
    @Inject(CDN_TRANSFORMATION_REPOSITORY)
    private readonly transformations: ICdnTransformationRepository,
    @Inject(YUPANA_OUTBOX_REPOSITORY) private readonly outbox: IYupanaOutboxRepository,
    private readonly prisma: PrismaService,
  ) {}

  async report(now: Date): Promise<CdnTransformationReportRun> {
    const lastProcessed = await this.transformations.findLastProcessedDay()
    const firstDay = lastProcessed === null ? await this.source.findFirstDay() : null
    const days = CdnTransformationDay.pendingDays(lastProcessed, firstDay, now)
    const processedDays: string[] = []

    for (const day of days) {
      const points = await this.source.readDay(day)
      const newCombinations = await this.prisma.$transaction(async (tx) => {
        const newPoints = await this.transformations.recordSightings(day, points, tx)
        const subjects = await this.transformations.resolveSubjects(newPoints, tx)
        await this.outbox.enqueue(CdnTransformationDay.reportsOf(day, newPoints, subjects), tx)
        await this.transformations.markProcessed(day, newPoints.length, tx)
        return newPoints.length
      })
      this.logger.log(`CDN transformations of ${day}: ${newCombinations} new this month`)
      processedDays.push(day)
    }

    return { processedDays }
  }
}
