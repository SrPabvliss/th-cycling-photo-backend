import { randomUUID } from 'node:crypto'
import type { Prisma } from '@generated/prisma/client'
import { Inject, Injectable, Logger } from '@nestjs/common'
import {
  type IInvoiceRequester,
  type IInvoiceSourceReader,
  INVOICE_SOURCE_READER,
  type IRikuchiyOutboxRepository,
  RIKUCHIY_OUTBOX_REPOSITORY,
} from '../../domain/ports'
import {
  type AnnulmentReason,
  RikuchiyAnnulment,
  type RikuchiyAnnulmentPayload,
} from '../../domain/rikuchiy-annulment'
import { RikuchiyEmission } from '../../domain/rikuchiy-emission'
import type { RikuchiyEmissionPayload } from '../../domain/rikuchiy-emission-payload'
import { OrderInvoiceStateRefresher } from './order-invoice-state-refresher.service'

@Injectable()
export class RikuchiyInvoiceRequesterService implements IInvoiceRequester {
  private readonly logger = new Logger(RikuchiyInvoiceRequesterService.name)

  constructor(
    @Inject(INVOICE_SOURCE_READER)
    private readonly invoiceSourceReader: IInvoiceSourceReader,
    @Inject(RIKUCHIY_OUTBOX_REPOSITORY)
    private readonly rikuchiyOutboxRepository: IRikuchiyOutboxRepository,
    private readonly orderInvoiceStateRefresher: OrderInvoiceStateRefresher,
  ) {}

  async request(orderId: string, tx: Prisma.TransactionClient): Promise<void> {
    const source = await this.invoiceSourceReader.find(orderId, tx)
    if (!source) {
      this.logger.error(`no invoice requested: order not found. orderId=${orderId}`)
      return
    }

    const emissionId = randomUUID()
    const rows = await this.rikuchiyOutboxRepository.findByOrder(orderId, tx)
    const annulmentCount = RikuchiyAnnulment.liveOf(rows).length
    const externalRef = RikuchiyEmission.externalRefOf(orderId, annulmentCount)
    const build = RikuchiyEmission.build(source, { emissionId, externalRef })

    if (build.kind === 'skip') {
      if (build.reason === 'not_a_sale') return
      const message = `no invoice requested: ${build.reason}. orderId=${orderId}`
      if (build.reason === 'no_billing_data') this.logger.warn(message)
      else this.logger.error(message)
      return
    }

    await this.rikuchiyOutboxRepository.enqueue(
      {
        orderId,
        emissionId,
        kind: 'emit',
        externalRef,
        payload: build.payload,
      },
      tx,
    )
    await this.orderInvoiceStateRefresher.refresh(orderId, tx)
  }

  async correct(orderId: string, tx: Prisma.TransactionClient): Promise<boolean> {
    const source = await this.invoiceSourceReader.find(orderId, tx)
    if (!source?.billing) return false

    const rows = await this.rikuchiyOutboxRepository.findByOrder(orderId, tx)
    const previous = rows.filter((row) => row.kind === 'emit' && row.status !== 'suppressed').at(-1)
    if (!previous) return false

    const emissionId = randomUUID()
    const queued = await this.rikuchiyOutboxRepository.enqueue(
      {
        orderId,
        emissionId,
        kind: 'emit',
        externalRef: previous.externalRef,
        payload: RikuchiyEmission.correct(
          previous.payload as RikuchiyEmissionPayload,
          RikuchiyEmission.buyerOf(source.billing),
          emissionId,
        ),
      },
      tx,
    )
    if (queued) await this.reopenRejection(orderId, tx)
    return queued
  }

  async retryAnnulment(orderId: string, tx: Prisma.TransactionClient): Promise<boolean> {
    const rows = await this.rikuchiyOutboxRepository.findByOrder(orderId, tx)
    const currentRef = rows
      .filter((row) => row.kind === 'emit' && row.status !== 'suppressed')
      .at(-1)?.externalRef
    const previous = rows
      .filter(
        (row) => row.kind === 'annul' && row.status === 'sent' && row.externalRef === currentRef,
      )
      .at(-1)
    if (!previous) return false

    const emissionId = randomUUID()
    const queued = await this.rikuchiyOutboxRepository.enqueue(
      {
        orderId,
        emissionId,
        kind: 'annul',
        externalRef: previous.externalRef,
        payload: {
          emissionId,
          reason: (previous.payload as RikuchiyAnnulmentPayload).reason,
        },
      },
      tx,
    )
    if (queued) await this.reopenRejection(orderId, tx)
    return queued
  }

  async withdraw(
    orderId: string,
    reason: AnnulmentReason,
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    await this.rikuchiyOutboxRepository.suppressPending(orderId, tx)
    await this.annulSentEmission(orderId, reason, tx)
    await this.orderInvoiceStateRefresher.refresh(orderId, tx)
  }

  private async reopenRejection(orderId: string, tx: Prisma.TransactionClient): Promise<void> {
    await tx.order.update({
      where: { id: orderId },
      data: { invoice_rejection_notified_at: null },
    })
    await this.orderInvoiceStateRefresher.refresh(orderId, tx)
  }

  private async annulSentEmission(
    orderId: string,
    reason: AnnulmentReason,
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    const rows = await this.rikuchiyOutboxRepository.findByOrder(orderId, tx)
    const sentEmissions = rows.filter((row) => row.kind === 'emit' && row.status === 'sent')
    if (sentEmissions.length === 0) return
    const externalRef = sentEmissions[sentEmissions.length - 1].externalRef
    const alreadyAnnulled = RikuchiyAnnulment.liveOf(rows).some(
      (row) => row.externalRef === externalRef,
    )
    if (alreadyAnnulled) return

    const emissionId = randomUUID()
    await this.rikuchiyOutboxRepository.enqueue(
      {
        orderId,
        emissionId,
        kind: 'annul',
        externalRef,
        payload: RikuchiyAnnulment.build(emissionId, reason),
      },
      tx,
    )
  }
}
