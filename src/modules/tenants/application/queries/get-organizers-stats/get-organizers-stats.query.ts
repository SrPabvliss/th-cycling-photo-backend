import type { OrganizerListFilters } from '../../../domain/ports/organizer-read-repository.port'

export class GetOrganizersStatsQuery {
  constructor(public readonly filters: OrganizerListFilters) {}
}
