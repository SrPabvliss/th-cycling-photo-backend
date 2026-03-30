import type { PhotoCategory } from '../entities'

export interface IPhotoCategoryWriteRepository {
  save(category: PhotoCategory): Promise<PhotoCategory>
  assignToEvent(eventId: string, photoCategoryId: string): Promise<string>
  unassignFromEvent(eventId: string, photoCategoryId: string): Promise<void>
}

export const PHOTO_CATEGORY_WRITE_REPOSITORY = Symbol('PHOTO_CATEGORY_WRITE_REPOSITORY')
