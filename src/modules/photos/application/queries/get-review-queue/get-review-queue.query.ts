import type { ReviewQueueStatusFilter } from '@photos/domain/ports'
import type { Pagination } from '@shared/application'

export class GetReviewQueueQuery {
  constructor(
    public readonly eventSlug: string,
    public readonly pagination: Pagination,
    public readonly status: ReviewQueueStatusFilter,
  ) {}
}
