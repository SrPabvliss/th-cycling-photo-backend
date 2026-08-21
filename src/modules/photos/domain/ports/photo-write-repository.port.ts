import type { Prisma } from '@generated/prisma/client'
import type { EventScope } from '@shared/authorization/domain/event-scope.vo'
import type { Photo } from '../entities'

export interface IPhotoWriteRepository {
  save(photo: Photo): Promise<Photo>
  saveMany(photos: Photo[], tx?: Prisma.TransactionClient): Promise<number>
  claimPhotoQuota(
    eventId: string,
    amount: number,
    tx: Prisma.TransactionClient,
  ): Promise<boolean>
  delete(id: string): Promise<void>
  /** Only updates photos among `photoIds` whose event falls inside `scope` — out-of-scope ids are silently skipped, not reported. */
  bulkUpdateCategory(
    photoIds: string[],
    photoCategoryId: number | null,
    scope: EventScope,
  ): Promise<number>
  setRequiresRetouch(photoId: string, value: boolean): Promise<void>
}

export const PHOTO_WRITE_REPOSITORY = Symbol('PHOTO_WRITE_REPOSITORY')
