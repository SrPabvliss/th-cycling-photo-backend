import { InjectQueue } from '@nestjs/bullmq'
import { Inject, Injectable, Logger, type OnModuleInit } from '@nestjs/common'
import type { Queue } from 'bullmq'
import { type IRikuchiyClient, RIKUCHIY_CLIENT } from '../../domain/ports'
import { RIKUCHIY_DELIVERY_QUEUE } from '../processors/rikuchiy-delivery.processor'

@Injectable()
export class RikuchiyDeliverySchedulerService implements OnModuleInit {
  static readonly SCHEDULER_ID = 'rikuchiy-delivery'
  static readonly EVERY_MS = 30_000

  private readonly logger = new Logger(RikuchiyDeliverySchedulerService.name)

  constructor(
    @InjectQueue(RIKUCHIY_DELIVERY_QUEUE) private readonly queue: Queue,
    @Inject(RIKUCHIY_CLIENT) private readonly rikuchiyClient: IRikuchiyClient,
  ) {}

  async onModuleInit(): Promise<void> {
    if (!this.rikuchiyClient.isConfigured()) {
      this.logger.log('rikuchiy is not configured: invoice requests stay in the outbox, unsent')
      await this.queue.removeJobScheduler(RikuchiyDeliverySchedulerService.SCHEDULER_ID)
      return
    }
    await this.queue.upsertJobScheduler(
      RikuchiyDeliverySchedulerService.SCHEDULER_ID,
      { every: RikuchiyDeliverySchedulerService.EVERY_MS },
      {
        name: 'deliver',
        opts: { removeOnComplete: true, removeOnFail: { age: 86400 } },
      },
    )
  }
}
