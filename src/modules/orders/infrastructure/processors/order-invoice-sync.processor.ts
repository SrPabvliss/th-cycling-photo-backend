import { Processor, WorkerHost } from '@nestjs/bullmq'
import { Inject, Logger } from '@nestjs/common'
import { PrismaService } from '@shared/infrastructure'
import {
  ORDER_INVOICE_SYNC_QUEUE,
  SYNC_ORDER_JOB,
  type SyncOrderJobData,
} from '@shared/rikuchiy/domain/order-invoice-sync'
import { type IRikuchiyClient, RIKUCHIY_CLIENT } from '@shared/rikuchiy/domain/ports'
import type { Job } from 'bullmq'
import { OrderInvoiceSyncService } from '../services/order-invoice-sync.service'

export { ORDER_INVOICE_SYNC_QUEUE }

@Processor(ORDER_INVOICE_SYNC_QUEUE, { concurrency: 1 })
export class OrderInvoiceSyncProcessor extends WorkerHost {
  static readonly BATCH_SIZE = 50
  static readonly MAX_CONSECUTIVE_FAILURES = 3

  private readonly logger = new Logger(OrderInvoiceSyncProcessor.name)

  constructor(
    @Inject(RIKUCHIY_CLIENT) private readonly rikuchiyClient: IRikuchiyClient,
    private readonly orderInvoiceSyncService: OrderInvoiceSyncService,
    private readonly prisma: PrismaService,
  ) {
    super()
  }

  async process(job?: Job<SyncOrderJobData>): Promise<void> {
    if (!this.rikuchiyClient.isConfigured()) return

    if (job?.name === SYNC_ORDER_JOB) {
      const view = await this.orderInvoiceSyncService.syncOrder(job.data.orderId)
      this.logger.log(
        `invoice follow-up sync: orderId=${job.data.orderId} state=${view?.state ?? 'no answer'}`,
      )
      return
    }

    const orders = await this.prisma.order.findMany({
      where: {
        OR: [
          { invoice_state: { in: ['requested', 'in_process'] } },
          { invoice_state: { not: 'none' }, invoice_synced_at: null },
        ],
      },
      select: { id: true },
      orderBy: { invoice_synced_at: { sort: 'asc', nulls: 'first' } },
      take: OrderInvoiceSyncProcessor.BATCH_SIZE,
    })

    const outcomes: string[] = []
    let consecutiveFailures = 0
    for (const order of orders) {
      const view = await this.orderInvoiceSyncService.syncOrder(order.id)
      outcomes.push(`${order.id}=${view?.state ?? 'no answer'}`)
      if (view !== null) {
        consecutiveFailures = 0
        continue
      }

      consecutiveFailures += 1
      await this.prisma.order.update({
        where: { id: order.id },
        data: { invoice_synced_at: new Date() },
      })
      this.logger.warn(`rikuchiy did not answer the invoice sync, will retry. orderId=${order.id}`)
      if (consecutiveFailures >= OrderInvoiceSyncProcessor.MAX_CONSECUTIVE_FAILURES) {
        this.logger.warn(
          `rikuchiy failed ${consecutiveFailures} invoice syncs in a row; the rest of the batch waits for the next run`,
        )
        break
      }
    }

    this.logger.log(
      `invoice sync run: ${orders.length} orders${outcomes.length ? ` (${outcomes.join(', ')})` : ''}`,
    )
  }
}
