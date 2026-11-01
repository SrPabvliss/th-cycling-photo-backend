import { InjectQueue } from '@nestjs/bullmq'
import { Injectable, type OnModuleInit } from '@nestjs/common'
import type { Queue } from 'bullmq'
import { PHOTO_PROCESSING_REAPER_QUEUE } from '../processors/photo-processing-reaper.processor'

@Injectable()
export class PhotoProcessingReaperSchedulerService implements OnModuleInit {
  static readonly SCHEDULER_ID = 'photo-processing-reaper'
  static readonly EVERY_MS = 300_000

  constructor(@InjectQueue(PHOTO_PROCESSING_REAPER_QUEUE) private readonly queue: Queue) {}

  async onModuleInit(): Promise<void> {
    await this.queue.upsertJobScheduler(
      PhotoProcessingReaperSchedulerService.SCHEDULER_ID,
      { every: PhotoProcessingReaperSchedulerService.EVERY_MS },
      {
        name: 'reap',
        opts: { removeOnComplete: true, removeOnFail: { age: 86400 } },
      },
    )
  }
}
