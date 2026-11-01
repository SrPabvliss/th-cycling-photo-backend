import type { Prisma } from '@generated/prisma/client'
import type { EventScope } from '@shared/authorization/domain/event-scope.vo'
import type { Photo } from '../entities'

export interface IPhotoWriteRepository {
  save(photo: Photo, tx?: Prisma.TransactionClient): Promise<Photo>
  saveMany(photos: Photo[], tx?: Prisma.TransactionClient): Promise<string[]>
  claimPhotoQuota(eventId: string, amount: number, tx: Prisma.TransactionClient): Promise<boolean>
  delete(id: string, tx?: Prisma.TransactionClient): Promise<void>
  /** Only updates photos among `photoIds` whose event falls inside `scope` — out-of-scope ids are silently skipped, not reported. */
  bulkUpdateCategory(
    photoIds: string[],
    photoCategoryId: number | null,
    scope: EventScope,
  ): Promise<number>
  setRequiresRetouch(photoId: string, value: boolean): Promise<void>
  /** Fails every `processing` photo whose attempt started before `olderThan` (upload time when it never recorded one), except `excludeIds`; writes one `photo_processings` failure row per photo and returns their ids. */
  markStalledAsFailed(olderThan: Date, excludeIds: string[]): Promise<string[]>
}

export const PHOTO_WRITE_REPOSITORY = Symbol('PHOTO_WRITE_REPOSITORY')
