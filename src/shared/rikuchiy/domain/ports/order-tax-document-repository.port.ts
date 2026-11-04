import type { Prisma } from '@generated/prisma/client'

export interface SriMessage {
  identifier: string
  message: string
  additionalInfo: string | null
  type: string
}

export interface TaxDocumentDelivery {
  kind: string
  requestedBy: { kind: string; id: string; name: string } | null
  recipients: { email: string; outcome: string }[]
  sentAt: string
}

export interface CachedTaxDocument {
  id: string
  externalRef: string
  type: 'invoice' | 'credit_note'
  state: string
  number: string
  accessKey: string
  issueDate: string
  authorizedAt: Date | null
  sriMessages: SriMessage[]
  deliveries: TaxDocumentDelivery[]
  syncedAt: Date | null
}

export interface IOrderTaxDocumentRepository {
  upsertMany(
    orderId: string,
    documents: CachedTaxDocument[],
    syncedAt: Date,
    tx?: Prisma.TransactionClient,
  ): Promise<void>
  findByOrder(orderId: string, tx?: Prisma.TransactionClient): Promise<CachedTaxDocument[]>
}

export const ORDER_TAX_DOCUMENT_REPOSITORY = Symbol('ORDER_TAX_DOCUMENT_REPOSITORY')
