import { type Prisma, RikuchiyOutboxKind, RikuchiyOutboxStatus } from '@generated/prisma/client'
import { Injectable } from '@nestjs/common'
import { PrismaService } from '@shared/infrastructure'
import type {
  IRikuchiyOutboxRepository,
  PendingRikuchiyItem,
  RikuchiyOutboxEntry,
  SuppressionResult,
} from '../../domain/ports'
import type { RikuchiyEmissionPayload } from '../../domain/rikuchiy-emission-payload'

@Injectable()
export class RikuchiyOutboxRepository implements IRikuchiyOutboxRepository {
  private static readonly MAX_REASON_LENGTH = 300

  constructor(private readonly prisma: PrismaService) {}

  async enqueue(entry: RikuchiyOutboxEntry, tx: Prisma.TransactionClient): Promise<void> {
    const payload = entry.payload as unknown as Prisma.InputJsonObject
    const { count } = await tx.rikuchiyOutboxItem.createMany({
      data: [
        {
          order_id: entry.orderId,
          kind: RikuchiyOutboxKind.emit,
          emission_id: entry.emissionId,
          payload,
        },
      ],
      skipDuplicates: true,
    })
    if (count > 0) return

    await tx.rikuchiyOutboxItem.updateMany({
      where: {
        order_id: entry.orderId,
        kind: RikuchiyOutboxKind.emit,
        status: RikuchiyOutboxStatus.suppressed,
      },
      data: {
        status: RikuchiyOutboxStatus.pending,
        emission_id: entry.emissionId,
        payload,
        attempts: 0,
        last_error: null,
      },
    })
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
    const rows = await this.prisma.rikuchiyOutboxItem.findMany({
      where: { status: RikuchiyOutboxStatus.pending },
      orderBy: { created_at: 'asc' },
      take: limit,
      select: { id: true, order_id: true, payload: true },
    })
    return rows.map((row) => ({
      id: row.id,
      orderId: row.order_id,
      payload: row.payload as unknown as RikuchiyEmissionPayload,
    }))
  }

  async markSent(id: string, taxDocumentId: string): Promise<boolean> {
    const { count } = await this.prisma.rikuchiyOutboxItem.updateMany({
      where: { id, status: RikuchiyOutboxStatus.pending },
      data: {
        status: RikuchiyOutboxStatus.sent,
        tax_document_id: taxDocumentId,
        sent_at: new Date(),
        last_error: null,
      },
    })
    return count > 0
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
