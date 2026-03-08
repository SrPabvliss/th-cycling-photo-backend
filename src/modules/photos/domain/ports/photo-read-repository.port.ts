import type { PhotoDetailProjection, PhotoListProjection } from '@photos/application/projections'
import type { SearchPhotosFilters } from '@photos/application/queries'
import type { PaginatedResult, Pagination } from '@shared/application'
import type { Photo } from '../entities'

export interface IPhotoReadRepository {
  findById(id: string): Promise<Photo | null>
  existsByEventAndFilename(eventId: string, filename: string): Promise<boolean>
  getPhotosList(
    eventId: string,
    pagination: Pagination,
  ): Promise<PaginatedResult<PhotoListProjection>>
  getPhotoDetail(id: string): Promise<PhotoDetailProjection | null>
  searchPhotos(
    filters: SearchPhotosFilters,
    pagination: Pagination,
  ): Promise<PaginatedResult<PhotoListProjection>>
}

export const PHOTO_READ_REPOSITORY = Symbol('PHOTO_READ_REPOSITORY')
