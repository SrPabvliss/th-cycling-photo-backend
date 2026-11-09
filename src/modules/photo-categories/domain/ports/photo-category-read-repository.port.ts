import type { PhotoCategoryProjection } from '../../application/projections'
import type { PhotoCategory } from '../entities'

export interface IPhotoCategoryReadRepository {
  findById(id: number): Promise<PhotoCategory | null>
  /** A category whose name clashes, case-insensitively, among the base set and `tenantId`'s own. */
  findClashing(name: string, tenantId: string | null): Promise<PhotoCategory | null>
  /** Base categories plus `tenantId`'s own; photo counts limited to that tenant's events. */
  getAvailable(tenantId: string | null): Promise<PhotoCategoryProjection[]>
  getByEvent(eventId: string): Promise<PhotoCategoryProjection[]>
}

export const PHOTO_CATEGORY_READ_REPOSITORY = Symbol('PHOTO_CATEGORY_READ_REPOSITORY')
