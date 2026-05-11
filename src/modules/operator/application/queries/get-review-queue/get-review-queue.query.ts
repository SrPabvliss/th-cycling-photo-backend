import type { ReviewQueueStatusFilter } from '@photos/domain/ports'
import { Pagination } from '@shared/application'

export class GetOperatorReviewQueueQuery {
  constructor(
    public readonly operatorId: string,
    public readonly pagination: Pagination,
    public readonly status: ReviewQueueStatusFilter,
    public readonly eventSlug: string | null,
  ) {}
}
