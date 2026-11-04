import type { Prisma } from '@generated/prisma/client'
import type { RikuchiyAnnulmentPayload } from '../rikuchiy-annulment'
import type { RikuchiyEmissionPayload } from '../rikuchiy-emission-payload'

export type RikuchiyOutboxKindName = 'emit' | 'annul'

export interface RikuchiyOutboxEntry {
  orderId: string
  emissionId: string
  kind: RikuchiyOutboxKindName
  externalRef: string
  payload: RikuchiyEmissionPayload | RikuchiyAnnulmentPayload
}

export interface PendingRikuchiyItem {
  id: string
  orderId: string
  kind: RikuchiyOutboxKindName
  externalRef: string
  payload: RikuchiyEmissionPayload | RikuchiyAnnulmentPayload
}

export interface OutboxRow {
  kind: RikuchiyOutboxKindName
  status: 'pending' | 'sent' | 'rejected' | 'suppressed'
  externalRef: string
  createdAt: Date
  sentAt: Date | null
  outcome: string | null
  rejectionReason: string | null
  payload: unknown
}

export interface OutboxSettlement {
  taxDocumentId: string | null
  outcome: string | null
}

export type SuppressionResult = 'suppressed' | 'already_sent' | 'none'

export interface IRikuchiyOutboxRepository {
  enqueue(entry: RikuchiyOutboxEntry, tx: Prisma.TransactionClient): Promise<boolean>
  suppressPending(orderId: string, tx: Prisma.TransactionClient): Promise<SuppressionResult>
  findByOrder(orderId: string, tx?: Prisma.TransactionClient): Promise<OutboxRow[]>
  findPending(limit: number): Promise<PendingRikuchiyItem[]>
  markSent(id: string, settlement: OutboxSettlement): Promise<boolean>
  markWithdrawnSent(
    id: string,
    settlement: OutboxSettlement,
    tx: Prisma.TransactionClient,
  ): Promise<void>
  markRejected(id: string, reason: string): Promise<void>
  markAttemptFailed(id: string, error: string): Promise<void>
}

export const RIKUCHIY_OUTBOX_REPOSITORY = Symbol('RIKUCHIY_OUTBOX_REPOSITORY')
