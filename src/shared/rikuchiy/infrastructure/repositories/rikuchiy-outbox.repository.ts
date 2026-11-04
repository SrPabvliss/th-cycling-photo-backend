import { type Prisma, RikuchiyOutboxKind, RikuchiyOutboxStatus } from '@generated/prisma/client'
import { Injectable } from '@nestjs/common'
import { PrismaService } from '@shared/infrastructure'
import type {
  IRikuchiyOutboxRepository,
  OutboxRow,
  OutboxSettlement,
  PendingRikuchiyItem,
  RikuchiyOutboxEntry,
  SuppressionResult,
} from '../../domain/ports'

interface PendingRow {
  id: string
  order_id: string
  kind: PendingRikuchiyItem['kind']
  external_ref: string
  payload: unknown
}

@Injectable()
export class RikuchiyOutboxRepository implements IRikuchiyOutboxRepository {
  private static readonly MAX_REASON_LENGTH = 300

  constructor(private readonly prisma: PrismaService) {}

  async enqueue(entry: RikuchiyOutboxEntry, tx: Prisma.TransactionClient): Promise<boolean> {
    const { count } = await tx.rikuchiyOutboxItem.createMany({
      data: [
        {
          order_id: entry.orderId,
          kind: entry.kind,
          emission_id: entry.emissionId,
          external_ref: entry.externalRef,
          payload: entry.payload as unknown as Prisma.InputJsonObject,
        },
      ],
      skipDuplicates: true,
    })
    return count > 0
  }

  async findByOrder(orderId: string, tx?: Prisma.TransactionClient): Promise<OutboxRow[]> {
    const rows = await (tx ?? this.prisma).rikuchiyOutboxItem.findMany({
      where: { order_id: orderId },
      orderBy: { created_at: 'asc' },
    })
    return rows.map((row) => ({
      kind: row.kind,
      status: row.status,
      externalRef: row.external_ref,
      createdAt: row.created_at,
      sentAt: row.sent_at,
      outcome: row.outcome,
      rejectionReason: row.rejection_reason,
      payload: row.payload,
    }))
  }

  async suppressPending(orderId: string, tx: Prisma.TransactionClient): Promise<SuppressionResult> {
    const { count } = await tx.rikuchiyOutboxItem.updateMany({
      where: {
        order_id: orderId,
        kind: RikuchiyOutboxKind.emit,
        status: RikuchiyOutboxStatus.pending,
      },
      data: { status: RikuchiyOutboxStatus.suppressed },
    })
    if (count > 0) return 'suppressed'

    const sent = await tx.rikuchiyOutboxItem.count({
      where: {
        order_id: orderId,
        kind: RikuchiyOutboxKind.emit,
        status: RikuchiyOutboxStatus.sent,
      },
    })
    return sent > 0 ? 'already_sent' : 'none'
  }

  async findPending(limit: number): Promise<PendingRikuchiyItem[]> {
    const rows = await this.prisma.$queryRaw<PendingRow[]>`
      SELECT item.id, item.order_id, item.kind::text AS kind, item.external_ref, item.payload
      FROM rikuchiy_outbox_items item
      WHERE item.status = 'pending'
        AND NOT EXISTS (
          SELECT 1
          FROM rikuchiy_outbox_items earlier
          WHERE earlier.order_id = item.order_id
            AND earlier.status = 'pending'
            AND (earlier.created_at < item.created_at
              OR (earlier.created_at = item.created_at AND earlier.id < item.id))
        )
      ORDER BY item.created_at ASC, item.id ASC
      LIMIT ${limit}
    `
    return rows.map((row) => ({
      id: row.id,
      orderId: row.order_id,
      kind: row.kind,
      externalRef: row.external_ref,
      payload: row.payload as PendingRikuchiyItem['payload'],
    }))
  }

  async markSent(id: string, settlement: OutboxSettlement): Promise<boolean> {
    const { count } = await this.prisma.rikuchiyOutboxItem.updateMany({
      where: { id, status: RikuchiyOutboxStatus.pending },
      data: {
        status: RikuchiyOutboxStatus.sent,
        tax_document_id: settlement.taxDocumentId,
        outcome: settlement.outcome,
        sent_at: new Date(),
        last_error: null,
      },
    })
    return count > 0
  }

  async markWithdrawnSent(
    id: string,
    settlement: OutboxSettlement,
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    await tx.rikuchiyOutboxItem.updateMany({
      where: { id, status: RikuchiyOutboxStatus.suppressed },
      data: {
        status: RikuchiyOutboxStatus.sent,
        tax_document_id: settlement.taxDocumentId,
        outcome: settlement.outcome,
        sent_at: new Date(),
        last_error: null,
      },
    })
  }

  async markRejected(id: string, reason: string): Promise<void> {
    await this.prisma.rikuchiyOutboxItem.updateMany({
      where: { id, status: RikuchiyOutboxStatus.pending },
      data: {
        status: RikuchiyOutboxStatus.rejected,
        rejection_reason: reason.slice(0, RikuchiyOutboxRepository.MAX_REASON_LENGTH),
        attempts: { increment: 1 },
      },
    })
  }

  async markAttemptFailed(id: string, error: string): Promise<void> {
    await this.prisma.rikuchiyOutboxItem.updateMany({
      where: { id, status: RikuchiyOutboxStatus.pending },
      data: { attempts: { increment: 1 }, last_error: error },
    })
  }
}
