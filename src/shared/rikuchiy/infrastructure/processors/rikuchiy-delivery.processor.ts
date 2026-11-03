import { Processor, WorkerHost } from '@nestjs/bullmq'
import { Inject, Logger } from '@nestjs/common'
import {
  type IRikuchiyClient,
  type IRikuchiyOutboxRepository,
  RIKUCHIY_CLIENT,
  RIKUCHIY_OUTBOX_REPOSITORY,
} from '../../domain/ports'

export const RIKUCHIY_DELIVERY_QUEUE = 'rikuchiy-delivery'

@Processor(RIKUCHIY_DELIVERY_QUEUE, { concurrency: 1 })
export class RikuchiyDeliveryProcessor extends WorkerHost {
  static readonly BATCH_SIZE = 50

  private readonly logger = new Logger(RikuchiyDeliveryProcessor.name)

  constructor(
    @Inject(RIKUCHIY_OUTBOX_REPOSITORY)
    private readonly rikuchiyOutboxRepository: IRikuchiyOutboxRepository,
    @Inject(RIKUCHIY_CLIENT) private readonly rikuchiyClient: IRikuchiyClient,
  ) {
    super()
  }

  async process(): Promise<void> {
    if (!this.rikuchiyClient.isConfigured()) return

    const items = await this.rikuchiyOutboxRepository.findPending(
      RikuchiyDeliveryProcessor.BATCH_SIZE,
    )

    for (const item of items) {
      const outcome = await this.rikuchiyClient.emit(item.payload)

      if (outcome.kind === 'accepted') {
        const marked = await this.rikuchiyOutboxRepository.markSent(item.id, outcome.taxDocumentId)
        if (!marked) {
          this.logger.error(
            `rikuchiy issued an invoice for an order withdrawn while it was being sent; annul it by hand. orderId=${item.orderId} taxDocumentId=${outcome.taxDocumentId}`,
          )
        }
      } else if (outcome.kind === 'rejected') {
        this.logger.error(
          `rikuchiy rejected the invoice request: ${outcome.reason}. orderId=${item.orderId}`,
        )
        await this.rikuchiyOutboxRepository.markRejected(item.id, outcome.reason)
      } else {
        this.logger.warn(
          `invoice request not delivered, will retry: ${outcome.reason}. orderId=${item.orderId}`,
        )
        await this.rikuchiyOutboxRepository.markAttemptFailed(item.id, outcome.reason)
      }
    }
  }
}
