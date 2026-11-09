import type { Pagination } from '@shared/application'

export class GetOrganizerEventsQuery {
  constructor(
    public readonly id: string,
    public readonly pagination: Pagination,
  ) {}
}
