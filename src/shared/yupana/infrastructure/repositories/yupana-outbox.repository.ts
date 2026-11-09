import type { Prisma } from '@generated/prisma/client'
import { YupanaOutboxKind, YupanaOutboxStatus } from '@generated/prisma/client'
import { Injectable } from '@nestjs/common'
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service'
import type {
  IYupanaOutboxRepository,
  PendingYupanaItem,
  YupanaOutboxEntry,
} from '../../domain/ports'

@Injectable()
export class YupanaOutboxRepository implements IYupanaOutboxRepository {
  constructor(private readonly prisma: PrismaService) {}

  async enqueue(entries: YupanaOutboxEntry[], tx?: Prisma.TransactionClient): Promise<void> {
    if (entries.length === 0) return
    const client = tx ?? this.prisma
    await client.yupanaOutboxItem.createMany({
      data: entries.map((entry) => ({
        kind: entry.kind,
        item_key: entry.itemKey,
        photo_id: entry.photoId,
        payload: entry.payload as Prisma.InputJsonObject,
      })),
      skipDuplicates: true,
    })
  }

  async findPending(kind: YupanaOutboxKind, limit: number): Promise<PendingYupanaItem[]> {
    const rows = await this.prisma.yupanaOutboxItem.findMany({
      where: { kind, status: YupanaOutboxStatus.pending },
      orderBy: { created_at: 'asc' },
      take: limit,
      select: { id: true, item_key: true, payload: true },
    })
    return rows.map((row) => ({
      id: row.id,
      itemKey: row.item_key,
      payload: row.payload as Record<string, unknown>,
    }))
  }

  async markSent(ids: string[]): Promise<void> {
    if (ids.length === 0) return
    await this.prisma.yupanaOutboxItem.updateMany({
      where: { id: { in: ids } },
      data: { status: YupanaOutboxStatus.sent, sent_at: new Date(), last_error: null },
    })
  }

  async markRejected(id: string, reason: string): Promise<void> {
    await this.prisma.yupanaOutboxItem.update({
      where: { id },
      data: { status: YupanaOutboxStatus.rejected, rejection_reason: reason },
    })
  }

  async markAttemptFailed(ids: string[], error: string): Promise<void> {
    if (ids.length === 0) return
    await this.prisma.yupanaOutboxItem.updateMany({
      where: { id: { in: ids } },
      data: { attempts: { increment: 1 }, last_error: error },
    })
  }

  async existsDeclarationForPhoto(photoId: string): Promise<boolean> {
    const found = await this.prisma.yupanaOutboxItem.findFirst({
      where: { photo_id: photoId, kind: YupanaOutboxKind.photo_declaration },
      select: { id: true },
    })
    return found !== null
  }
}
