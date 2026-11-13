import type { Pagination } from '@shared/application'
import type { PublicEventListFilters } from './get-public-events-list.dto'

export class GetPublicEventsListQuery {
  constructor(
    public readonly pagination: Pagination,
    public readonly filters: PublicEventListFilters,
  ) {}
}
