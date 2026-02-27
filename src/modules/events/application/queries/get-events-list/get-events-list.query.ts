import type { Pagination } from '@shared/application'

export class GetEventsListQuery {
  constructor(
    public readonly pagination: Pagination,
    public readonly includeArchived: boolean = false,
  ) {}
}
