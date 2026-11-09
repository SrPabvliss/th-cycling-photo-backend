import type { PaginatedResult, Pagination } from '@shared/application'
import type { OrganizerDetailProjection } from '../../application/projections/organizer-detail.projection'
import type { OrganizerEventProjection } from '../../application/projections/organizer-event.projection'
import type { OrganizerRowProjection } from '../../application/projections/organizer-list.projection'
import type { OrganizersStatsProjection } from '../../application/projections/organizers-stats.projection'

export const ORGANIZER_READ_REPOSITORY = Symbol('ORGANIZER_READ_REPOSITORY')

export const ORGANIZER_TABS = ['all', 'active', 'no_quota', 'expiring', 'invitations'] as const
export type OrganizerTab = (typeof ORGANIZER_TABS)[number]

export const ORGANIZER_SORTS = ['recent', 'available', 'expiry', 'events'] as const
export type OrganizerSort = (typeof ORGANIZER_SORTS)[number]

export interface OrganizerListFilters {
  search?: string
  tab?: OrganizerTab
  sort?: OrganizerSort
}

export interface IOrganizerReadRepository {
  getOrganizersPage(
    filters: OrganizerListFilters,
    pagination: Pagination,
  ): Promise<PaginatedResult<OrganizerRowProjection>>
  getOrganizersStats(filters: OrganizerListFilters): Promise<OrganizersStatsProjection>
  getOrganizerDetail(id: string): Promise<OrganizerDetailProjection | null>
  getOrganizerEvents(
    id: string,
    pagination: Pagination,
  ): Promise<PaginatedResult<OrganizerEventProjection>>
}
