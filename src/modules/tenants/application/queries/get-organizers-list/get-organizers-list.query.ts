import type { Pagination } from '@shared/application'
import type { OrganizerListFilters } from '../../../domain/ports/organizer-read-repository.port'

export class GetOrganizersListQuery {
  constructor(
    public readonly pagination: Pagination,
    public readonly filters: OrganizerListFilters,
  ) {}
}
