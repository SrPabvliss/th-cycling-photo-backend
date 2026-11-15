import type { PublicEventListFilters } from '../get-public-events-list/get-public-events-list.dto'

export class GetPublicEventFiltersQuery {
  constructor(public readonly filters: PublicEventListFilters) {}
}
