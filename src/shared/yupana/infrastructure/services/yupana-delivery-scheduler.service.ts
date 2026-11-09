import { InjectQueue } from '@nestjs/bullmq'
import { Inject, Injectable, Logger, type OnModuleInit } from '@nestjs/common'
import type { Queue } from 'bullmq'
import { type IYupanaClient, YUPANA_CLIENT } from '../../domain/ports'
import { YUPANA_DELIVERY_QUEUE } from '../processors/yupana-delivery.processor'

@Injectable()
export class YupanaDeliverySchedulerService implements OnModuleInit {
  static readonly SCHEDULER_ID = 'yupana-delivery'
  static readonly EVERY_MS = 30_000

  private readonly logger = new Logger(YupanaDeliverySchedulerService.name)

  constructor(
    @InjectQueue(YUPANA_DELIVERY_QUEUE) private readonly queue: Queue,
    @Inject(YUPANA_CLIENT) private readonly client: IYupanaClient,
  ) {}

  async onModuleInit(): Promise<void> {
    if (!this.client.isConfigured()) {
      this.logger.log('yupana is not configured: usage reports stay in the outbox, unsent')
      await this.queue.removeJobScheduler(YupanaDeliverySchedulerService.SCHEDULER_ID)
      return
    }
    await this.queue.upsertJobScheduler(
      YupanaDeliverySchedulerService.SCHEDULER_ID,
      { every: YupanaDeliverySchedulerService.EVERY_MS },
      {
        name: 'deliver',
        opts: { removeOnComplete: true, removeOnFail: { age: 86400 } },
      },
    )
  }
}
