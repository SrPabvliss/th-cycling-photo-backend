import type {
  PreviewDataProjection,
  PreviewLinkListProjection,
} from '@previews/application/projections'
import type { PaginatedResult, Pagination } from '@shared/application'
import type { PreviewLink } from '../entities'

export interface IPreviewLinkReadRepository {
  findByToken(token: string): Promise<PreviewLink | null>
  getListByEvent(
    eventId: string,
    pagination: Pagination,
  ): Promise<PaginatedResult<PreviewLinkListProjection>>
  getPreviewData(token: string): Promise<PreviewDataProjection | null>
  /** True if any preview link includes this photo (blocks hard-delete). */
  existsByPhotoId(photoId: string): Promise<boolean>
}

export const PREVIEW_LINK_READ_REPOSITORY = Symbol('PREVIEW_LINK_READ_REPOSITORY')
