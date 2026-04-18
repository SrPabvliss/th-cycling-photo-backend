import type { PhotoCategoryProjection } from '../../application/projections'
import type { PhotoCategory } from '../entities'

export interface IPhotoCategoryReadRepository {
  findById(id: number): Promise<PhotoCategory | null>
  findByName(name: string): Promise<PhotoCategory | null>
  getAll(): Promise<PhotoCategoryProjection[]>
  getByEvent(eventId: string): Promise<PhotoCategoryProjection[]>
}

export const PHOTO_CATEGORY_READ_REPOSITORY = Symbol('PHOTO_CATEGORY_READ_REPOSITORY')
