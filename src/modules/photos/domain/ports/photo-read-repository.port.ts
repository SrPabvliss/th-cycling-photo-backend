import type {
  PhotoDetailProjection,
  PhotoListProjection,
  SimilarPhotoProjection,
} from '@photos/application/projections'
import type { SearchPhotosFilters } from '@photos/application/queries'
import type { PaginatedResult, Pagination } from '@shared/application'
import type { Photo } from '../entities'

export interface IPhotoReadRepository {
  findById(id: string): Promise<Photo | null>
  existsByEventAndFilename(eventId: string, filename: string): Promise<boolean>
  getPhotosList(
    eventId: string,
    pagination: Pagination,
    classified?: boolean,
  ): Promise<PaginatedResult<PhotoListProjection>>
  getPhotoDetail(id: string): Promise<PhotoDetailProjection | null>
  searchPhotos(
    filters: SearchPhotosFilters,
    pagination: Pagination,
  ): Promise<PaginatedResult<PhotoListProjection>>
  findFirstStorageKeyByEvent(eventId: string): Promise<string | null>
  findFirstStorageKeysByEventIds(eventIds: string[]): Promise<Map<string, string>>
  getTotalFileSizeByEvent(eventId: string): Promise<number>
  getTotalFileSizesByEventIds(eventIds: string[]): Promise<Map<string, number>>
  getClassifiedCountByEvent(eventId: string): Promise<number>
  getClassifiedCountsByEventIds(eventIds: string[]): Promise<Map<string, number>>
  getAllPhotoKeysForEvent(
    eventId: string,
  ): Promise<Array<{ filename: string; storageKey: string; fileSize: number }>>
  getResumePoint(eventId: string, limit: number): Promise<{ photoId: string | null; page: number }>
  countByIds(ids: string[]): Promise<number>
  findSimilar(photoId: string, eventId: string, limit: number): Promise<SimilarPhotoProjection[]>
  countAll(): Promise<number>
  sumAllFileSize(): Promise<number>
}

export const PHOTO_READ_REPOSITORY = Symbol('PHOTO_READ_REPOSITORY')
