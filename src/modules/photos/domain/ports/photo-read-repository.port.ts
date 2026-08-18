import type { PhotoStatus } from '@generated/prisma/client'
import type {
  PhotoDetailProjection,
  PhotoListProjection,
  PhotoViewProjection,
  SimilarPhotoProjection,
} from '@photos/application/projections'
import type { SearchPhotosFilters } from '@photos/application/queries'
import type { PaginatedResult, Pagination } from '@shared/application'
import type { EventScope } from '@shared/authorization/domain/event-scope.vo'
import type { Photo } from '../entities'

export interface ReviewQueueRepoItem {
  id: string
  publicSlug: string
  filename: string
  status: PhotoStatus
  reviewedAt: Date | null
  minBibConfidence: number | null
  bibsCount: number
  colorsCount: number
}

export interface ReviewQueueByEventsRepoItem extends ReviewQueueRepoItem {
  eventId: string
}

export type ReviewQueueStatusFilter = 'all' | 'pending' | 'reviewed'

export const REVIEW_QUEUE_STATUS_FILTERS: ReviewQueueStatusFilter[] = ['all', 'pending', 'reviewed']

export interface IPhotoReadRepository {
  findById(id: string): Promise<Photo | null>
  /**
   * Scoped load — the tenant-boundary check for every mutation and
   * single-entity read in this module. `findById` alone is not a safe
   * basis for `authz.assert()`: `assert` only tests whether the caller
   * holds the permission key (template/grants), never whether the target
   * row belongs to the caller's tenant. Loading through this method means
   * an out-of-scope id resolves to `null` (404), the same non-disclosure
   * behaviour as `getEventDetailBySlug`.
   */
  findByIdInScope(id: string, scope: EventScope): Promise<Photo | null>
  existsByEventAndFilename(eventId: string, filename: string): Promise<boolean>
  getPhotosList(
    eventId: string,
    pagination: Pagination,
    classified: boolean | undefined,
    photoCategoryId: number | undefined,
    scope: EventScope,
  ): Promise<PaginatedResult<PhotoListProjection>>
  getPhotoDetail(id: string, scope: EventScope): Promise<PhotoDetailProjection | null>
  getPhotoDetailBySlug(slug: string, scope: EventScope): Promise<PhotoDetailProjection | null>
  searchPhotos(
    filters: SearchPhotosFilters,
    pagination: Pagination,
    scope: EventScope,
  ): Promise<PaginatedResult<PhotoListProjection>>
  getTotalFileSizeByEvent(eventId: string): Promise<number>
  getTotalFileSizesByEventIds(eventIds: string[]): Promise<Map<string, number>>
  getClassifiedCountByEvent(eventId: string): Promise<number>
  getClassifiedCountsByEventIds(eventIds: string[]): Promise<Map<string, number>>
  getAllPhotoKeysForEvent(
    eventId: string,
    scope: EventScope,
  ): Promise<Array<{ filename: string; storageKey: string; fileSize: number }>>
  getResumePoint(
    eventId: string,
    limit: number,
    scope: EventScope,
  ): Promise<{ photoId: string | null; page: number }>
  countByIds(ids: string[]): Promise<number>
  countByIdsAndEvent(photoIds: string[], eventId: string): Promise<number>
  /** Distinct event ids among `photoIds` that also fall inside `scope` — out-of-scope photos are silently excluded, not reported. */
  getDistinctEventIdsForPhotoIds(photoIds: string[], scope: EventScope): Promise<string[]>
  findSimilar(photoId: string, eventId: string, limit: number): Promise<SimilarPhotoProjection[]>
  getPhotoViewBySlug(slug: string, scope: EventScope): Promise<PhotoViewProjection | null>
  countAll(scope: EventScope): Promise<number>
  sumAllFileSize(scope: EventScope): Promise<number>
  getReviewQueue(params: {
    eventSlug: string
    status: ReviewQueueStatusFilter
    limit: number
    offset: number
    scope: EventScope
  }): Promise<{ items: ReviewQueueRepoItem[]; total: number }>
  getReviewQueueByEventIds(params: {
    eventIds: string[]
    status: ReviewQueueStatusFilter
    limit: number
    offset: number
  }): Promise<{ items: ReviewQueueByEventsRepoItem[]; total: number }>
}

export const PHOTO_READ_REPOSITORY = Symbol('PHOTO_READ_REPOSITORY')
