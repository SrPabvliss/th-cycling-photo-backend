import type { Pagination } from '@shared/application'

export class GetReviewQueueQuery {
  constructor(
    public readonly eventId: string,
    public readonly pagination: Pagination,
    public readonly onlyPending: boolean,
  ) {}
}
