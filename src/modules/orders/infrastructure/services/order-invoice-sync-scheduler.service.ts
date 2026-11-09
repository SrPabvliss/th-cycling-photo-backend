import { InjectQueue } from '@nestjs/bullmq'
import { Inject, Injectable, Logger, type OnModuleInit } from '@nestjs/common'
import { type IRikuchiyClient, RIKUCHIY_CLIENT } from '@shared/rikuchiy/domain/ports'
import type { Queue } from 'bullmq'
import { ORDER_INVOICE_SYNC_QUEUE } from '../processors/order-invoice-sync.processor'

@Injectable()
export class OrderInvoiceSyncSchedulerService implements OnModuleInit {
  static readonly SCHEDULER_ID = 'order-invoice-sync'
  static readonly EVERY_MS = 300_000

  private readonly logger = new Logger(OrderInvoiceSyncSchedulerService.name)

  constructor(
    @InjectQueue(ORDER_INVOICE_SYNC_QUEUE) private readonly queue: Queue,
    @Inject(RIKUCHIY_CLIENT) private readonly rikuchiyClient: IRikuchiyClient,
  ) {}

  async onModuleInit(): Promise<void> {
    if (!this.rikuchiyClient.isConfigured()) {
      this.logger.log('rikuchiy is not configured: the invoice state of orders is not synced')
      await this.queue.removeJobScheduler(OrderInvoiceSyncSchedulerService.SCHEDULER_ID)
      return
    }
    await this.queue.upsertJobScheduler(
      OrderInvoiceSyncSchedulerService.SCHEDULER_ID,
      { every: OrderInvoiceSyncSchedulerService.EVERY_MS },
      {
        name: 'sync',
        opts: { removeOnComplete: true, removeOnFail: { age: 86400 } },
      },
    )
  }
}
