import type {
  PreviewDataProjection,
  PreviewLinkListProjection,
} from '@previews/application/projections'
import type { PaginatedResult, Pagination } from '@shared/application'
import type { EventScope } from '@shared/authorization/domain/event-scope.vo'
import type { PreviewLink } from '../entities'

export interface IPreviewLinkReadRepository {
  findByToken(token: string): Promise<PreviewLink | null>
  getListByEvent(
    eventId: string,
    pagination: Pagination,
    scope: EventScope,
  ): Promise<PaginatedResult<PreviewLinkListProjection>>
  getPreviewData(token: string): Promise<PreviewDataProjection | null>
  /** Public name of the event's organizer, falling back to its legal name. */
  findOrganizerName(eventId: string): Promise<string | null>
  /** Whether an order keeps the link taken: placed and standing, or a card draft being paid. */
  hasLiveOrder(previewLinkId: string): Promise<boolean>
  /** The id of the live order on the link when it belongs to `userId`, otherwise null. */
  findLiveOrderIdOf(previewLinkId: string, userId: string): Promise<string | null>
  /** True if any preview link includes this photo (blocks hard-delete). */
  existsByPhotoId(photoId: string): Promise<boolean>
}

export const PREVIEW_LINK_READ_REPOSITORY = Symbol('PREVIEW_LINK_READ_REPOSITORY')
