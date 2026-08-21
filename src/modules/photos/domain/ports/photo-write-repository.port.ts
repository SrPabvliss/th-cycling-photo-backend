import type { EventScope } from '@shared/authorization/domain/event-scope.vo'
import type { Photo } from '../entities'

export interface IPhotoWriteRepository {
  save(photo: Photo): Promise<Photo>
  saveMany(photos: Photo[]): Promise<number>
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
