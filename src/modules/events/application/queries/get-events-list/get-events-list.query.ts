import type { Pagination } from '@shared/application'
import type { EventListFilters } from './get-events-list.dto'

export class GetEventsListQuery {
  constructor(
    public readonly pagination: Pagination,
    public readonly filters: EventListFilters,
    public readonly userId: string,
  ) {}
}
