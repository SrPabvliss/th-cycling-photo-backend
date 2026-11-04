import { Processor, WorkerHost } from '@nestjs/bullmq'
import { Inject, Logger } from '@nestjs/common'
import { PrismaService } from '@shared/infrastructure'
import { type IRikuchiyClient, RIKUCHIY_CLIENT } from '@shared/rikuchiy/domain/ports'
import { OrderInvoiceSyncService } from '../services/order-invoice-sync.service'

export const ORDER_INVOICE_SYNC_QUEUE = 'order-invoice-sync'

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

  async process(): Promise<void> {
    if (!this.rikuchiyClient.isConfigured()) return

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

    let consecutiveFailures = 0
    for (const order of orders) {
      const view = await this.orderInvoiceSyncService.syncOrder(order.id)
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
        return
      }
    }
  }
}
