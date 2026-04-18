import type { PhotoCategory } from '../entities'

export interface IPhotoCategoryWriteRepository {
  save(category: PhotoCategory): Promise<PhotoCategory>
  assignToEvent(eventId: string, photoCategoryId: number): Promise<string>
  unassignFromEvent(eventId: string, photoCategoryId: number): Promise<void>
}

export const PHOTO_CATEGORY_WRITE_REPOSITORY = Symbol('PHOTO_CATEGORY_WRITE_REPOSITORY')
