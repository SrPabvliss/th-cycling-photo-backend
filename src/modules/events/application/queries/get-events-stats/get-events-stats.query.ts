import type { EventListFilters } from '../get-events-list/get-events-list.dto'

export class GetEventsStatsQuery {
  constructor(
    public readonly filters: EventListFilters,
    public readonly userId: string,
  ) {}
}
