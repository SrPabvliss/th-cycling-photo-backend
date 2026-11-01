import type { Prisma, YupanaOutboxKind } from '@generated/prisma/client'

export interface YupanaOutboxEntry {
  kind: YupanaOutboxKind
  itemKey: string
  photoId: string | null
  payload: Record<string, unknown>
}

export interface PendingYupanaItem {
  id: string
  itemKey: string
  payload: Record<string, unknown>
}

export interface IYupanaOutboxRepository {
  enqueue(entries: YupanaOutboxEntry[], tx?: Prisma.TransactionClient): Promise<void>
  findPending(kind: YupanaOutboxKind, limit: number): Promise<PendingYupanaItem[]>
  markSent(ids: string[]): Promise<void>
  markRejected(id: string, reason: string): Promise<void>
  markAttemptFailed(ids: string[], error: string): Promise<void>
  existsDeclarationForPhoto(photoId: string): Promise<boolean>
}

export const YUPANA_OUTBOX_REPOSITORY = Symbol('YUPANA_OUTBOX_REPOSITORY')
