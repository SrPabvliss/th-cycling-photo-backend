import { randomUUID } from 'node:crypto'
import { Processor, WorkerHost } from '@nestjs/bullmq'
import { Inject, Logger } from '@nestjs/common'
import { PrismaService } from '@shared/infrastructure'
import {
  type IRikuchiyClient,
  type IRikuchiyOutboxRepository,
  type OutboxSettlement,
  type PendingRikuchiyItem,
  RIKUCHIY_CLIENT,
  RIKUCHIY_OUTBOX_REPOSITORY,
} from '../../domain/ports'
import { RikuchiyAnnulment, type RikuchiyAnnulmentPayload } from '../../domain/rikuchiy-annulment'
import type { RikuchiyEmissionPayload } from '../../domain/rikuchiy-emission-payload'
import { OrderInvoiceStateRefresher } from '../services/order-invoice-state-refresher.service'

export const RIKUCHIY_DELIVERY_QUEUE = 'rikuchiy-delivery'

@Processor(RIKUCHIY_DELIVERY_QUEUE, { concurrency: 1 })
export class RikuchiyDeliveryProcessor extends WorkerHost {
  static readonly BATCH_SIZE = 50

  private readonly logger = new Logger(RikuchiyDeliveryProcessor.name)

  constructor(
    @Inject(RIKUCHIY_OUTBOX_REPOSITORY)
    private readonly rikuchiyOutboxRepository: IRikuchiyOutboxRepository,
    @Inject(RIKUCHIY_CLIENT) private readonly rikuchiyClient: IRikuchiyClient,
    private readonly prisma: PrismaService,
    private readonly orderInvoiceStateRefresher: OrderInvoiceStateRefresher,
  ) {
    super()
  }

  async process(): Promise<void> {
    if (!this.rikuchiyClient.isConfigured()) return

    const items = await this.rikuchiyOutboxRepository.findPending(
      RikuchiyDeliveryProcessor.BATCH_SIZE,
    )

    for (const item of items) {
      if (item.kind === 'annul') await this.deliverAnnulment(item)
      else await this.deliverEmission(item)
    }
  }

  private async deliverEmission(item: PendingRikuchiyItem): Promise<void> {
    const outcome = await this.rikuchiyClient.emit(item.payload as RikuchiyEmissionPayload)

    if (outcome.kind === 'accepted') {
      const settlement = { taxDocumentId: outcome.taxDocumentId, outcome: null }
      const marked = await this.rikuchiyOutboxRepository.markSent(item.id, settlement)
      if (!marked) await this.annulWithdrawnEmission(item, settlement)
      else await this.orderInvoiceStateRefresher.settle(item.orderId)
    } else if (outcome.kind === 'rejected') {
      this.logger.error(
        `rikuchiy rejected the invoice request: ${outcome.reason}. orderId=${item.orderId}`,
      )
      await this.rikuchiyOutboxRepository.markRejected(item.id, outcome.message)
      await this.orderInvoiceStateRefresher.settle(item.orderId)
    } else {
      this.logger.warn(
        `invoice request not delivered, will retry: ${outcome.reason}. orderId=${item.orderId}`,
      )
      await this.rikuchiyOutboxRepository.markAttemptFailed(item.id, outcome.reason)
    }
  }

  private async deliverAnnulment(item: PendingRikuchiyItem): Promise<void> {
    const result = await this.rikuchiyClient.annul(
      item.externalRef,
      item.payload as RikuchiyAnnulmentPayload,
    )

    if (result.kind === 'accepted') {
      if (result.outcome === 'stands') {
        this.logger.error(
          `rikuchiy kept the invoice standing after an annulment request. orderId=${item.orderId}`,
        )
      }
      await this.rikuchiyOutboxRepository.markSent(item.id, {
        taxDocumentId: result.creditNoteId,
        outcome: result.outcome,
      })
      await this.orderInvoiceStateRefresher.settle(item.orderId)
    } else if (result.kind === 'rejected') {
      this.logger.error(
        `rikuchiy rejected the annulment request: ${result.reason}. orderId=${item.orderId}`,
      )
      await this.rikuchiyOutboxRepository.markRejected(item.id, result.message)
      await this.orderInvoiceStateRefresher.settle(item.orderId)
    } else {
      this.logger.warn(
        `annulment request not delivered, will retry: ${result.reason}. orderId=${item.orderId}`,
      )
      await this.rikuchiyOutboxRepository.markAttemptFailed(item.id, result.reason)
    }
  }

  private async annulWithdrawnEmission(
    item: PendingRikuchiyItem,
    settlement: OutboxSettlement,
  ): Promise<void> {
    const order = await this.prisma.order.findUnique({
      where: { id: item.orderId },
      select: { status: true },
    })
    const reason = order?.status === 'gifted' ? 'gifted' : 'cancelled'
    const emissionId = randomUUID()

    await this.prisma.$transaction(async (tx) => {
      await this.rikuchiyOutboxRepository.markWithdrawnSent(item.id, settlement, tx)
      const rows = await this.rikuchiyOutboxRepository.findByOrder(item.orderId, tx)
      const alreadyAnnulled = RikuchiyAnnulment.liveOf(rows).some(
        (row) => row.externalRef === item.externalRef,
      )
      if (!alreadyAnnulled) {
        await this.rikuchiyOutboxRepository.enqueue(
          {
            orderId: item.orderId,
            emissionId,
            kind: 'annul',
            externalRef: item.externalRef,
            payload: RikuchiyAnnulment.build(emissionId, reason),
          },
          tx,
        )
      }
      await this.orderInvoiceStateRefresher.settle(item.orderId, tx)
    })
  }
}
