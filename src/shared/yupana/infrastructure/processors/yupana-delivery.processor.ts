import { YupanaOutboxKind } from '@generated/prisma/client'
import { Processor, WorkerHost } from '@nestjs/bullmq'
import { Inject, Logger } from '@nestjs/common'
import {
  type IYupanaClient,
  type IYupanaOutboxRepository,
  type PendingYupanaItem,
  YUPANA_CLIENT,
  YUPANA_OUTBOX_REPOSITORY,
  type YupanaItemResult,
} from '../../domain/ports'

export const YUPANA_DELIVERY_QUEUE = 'yupana-delivery'

@Processor(YUPANA_DELIVERY_QUEUE, { concurrency: 1 })
export class YupanaDeliveryProcessor extends WorkerHost {
  static readonly BATCH_SIZE = 500
  static readonly NO_RESULT = 'no result in the yupana answer'

  private readonly logger = new Logger(YupanaDeliveryProcessor.name)

  constructor(
    @Inject(YUPANA_OUTBOX_REPOSITORY) private readonly outbox: IYupanaOutboxRepository,
    @Inject(YUPANA_CLIENT) private readonly client: IYupanaClient,
  ) {
    super()
  }

  async process(): Promise<void> {
    if (!this.client.isConfigured()) return
    await this.deliver(YupanaOutboxKind.usage_report, (items) => this.client.sendReports(items))
    await this.deliver(YupanaOutboxKind.photo_declaration, (items) =>
      this.client.sendDeclarations(items),
    )
  }

  private async deliver(
    kind: YupanaOutboxKind,
    send: (payloads: Record<string, unknown>[]) => Promise<YupanaItemResult[]>,
  ): Promise<void> {
    const items = await this.outbox.findPending(kind, YupanaDeliveryProcessor.BATCH_SIZE)
    if (items.length === 0) return

    let results: YupanaItemResult[]
    try {
      results = await send(items.map((item) => item.payload))
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      this.logger.warn(`Delivery of ${items.length} ${kind} item(s) to yupana failed: ${message}`)
      await this.outbox.markAttemptFailed(
        items.map((item) => item.id),
        message,
      )
      return
    }

    await this.settle(kind, items, results)
  }

  private async settle(
    kind: YupanaOutboxKind,
    items: PendingYupanaItem[],
    results: YupanaItemResult[],
  ): Promise<void> {
    const byKey = new Map(results.map((result) => [result.key, result]))
    const sent: string[] = []
    const unanswered: string[] = []

    for (const item of items) {
      const result = byKey.get(item.itemKey)
      if (!result) {
        unanswered.push(item.id)
      } else if (result.outcome === 'rejected') {
        const reason = result.reason ?? 'unknown'
        this.logger.warn(`yupana rejected ${kind} ${item.itemKey}: ${reason}`)
        await this.outbox.markRejected(item.id, reason)
      } else {
        sent.push(item.id)
      }
    }

    await this.outbox.markSent(sent)
    if (unanswered.length > 0) {
      this.logger.warn(`yupana answered nothing about ${unanswered.length} ${kind} item(s)`)
      await this.outbox.markAttemptFailed(unanswered, YupanaDeliveryProcessor.NO_RESULT)
    }
  }
}
