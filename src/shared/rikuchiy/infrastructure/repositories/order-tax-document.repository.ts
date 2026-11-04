import type { Prisma } from '@generated/prisma/client'
import { Injectable } from '@nestjs/common'
import { PrismaService } from '@shared/infrastructure'
import type {
  CachedTaxDocument,
  IOrderTaxDocumentRepository,
  SriMessage,
  TaxDocumentDelivery,
} from '../../domain/ports'

@Injectable()
export class OrderTaxDocumentRepository implements IOrderTaxDocumentRepository {
  constructor(private readonly prisma: PrismaService) {}

  async upsertMany(
    orderId: string,
    documents: CachedTaxDocument[],
    syncedAt: Date,
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    const client = tx ?? this.prisma
    for (const document of documents) {
      const data = {
        order_id: orderId,
        external_ref: document.externalRef,
        type: document.type,
        state: document.state,
        number: document.number,
        access_key: document.accessKey,
        issue_date: new Date(`${document.issueDate}T00:00:00.000Z`),
        authorized_at: document.authorizedAt,
        sri_messages: document.sriMessages as unknown as Prisma.InputJsonArray,
        deliveries: document.deliveries as unknown as Prisma.InputJsonArray,
        synced_at: syncedAt,
      }
      await client.orderTaxDocument.upsert({
        where: { id: document.id },
        create: { id: document.id, ...data },
        update: data,
      })
    }
  }

  async findByOrder(orderId: string, tx?: Prisma.TransactionClient): Promise<CachedTaxDocument[]> {
    const rows = await (tx ?? this.prisma).orderTaxDocument.findMany({
      where: { order_id: orderId },
      orderBy: { issue_date: 'asc' },
    })
    return rows.map((row) => ({
      id: row.id,
      externalRef: row.external_ref,
      type: row.type as CachedTaxDocument['type'],
      state: row.state,
      number: row.number,
      accessKey: row.access_key,
      issueDate: row.issue_date.toISOString().slice(0, 10),
      authorizedAt: row.authorized_at,
      sriMessages: row.sri_messages as unknown as SriMessage[],
      deliveries: row.deliveries as unknown as TaxDocumentDelivery[],
      syncedAt: row.synced_at,
    }))
  }
}
