import type { Prisma } from '@generated/prisma/client'
import type { RikuchiyEmissionPayload } from '../rikuchiy-emission-payload'

export interface RikuchiyOutboxEntry {
  orderId: string
  emissionId: string
  payload: RikuchiyEmissionPayload
}

export interface PendingRikuchiyItem {
  id: string
  orderId: string
  payload: RikuchiyEmissionPayload
}

export type SuppressionResult = 'suppressed' | 'already_sent' | 'none'

export interface IRikuchiyOutboxRepository {
  enqueue(entry: RikuchiyOutboxEntry, tx: Prisma.TransactionClient): Promise<void>
  suppressPending(orderId: string, tx: Prisma.TransactionClient): Promise<SuppressionResult>
  findPending(limit: number): Promise<PendingRikuchiyItem[]>
  markSent(id: string, taxDocumentId: string): Promise<boolean>
  markRejected(id: string, reason: string): Promise<void>
  markAttemptFailed(id: string, error: string): Promise<void>
}

export const RIKUCHIY_OUTBOX_REPOSITORY = Symbol('RIKUCHIY_OUTBOX_REPOSITORY')
