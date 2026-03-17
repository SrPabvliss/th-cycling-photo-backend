import type { Pagination } from '@shared/application'

export class GetUsersListQuery {
  constructor(
    public readonly pagination: Pagination,
    public readonly includeInactive: boolean = false,
  ) {}
}
