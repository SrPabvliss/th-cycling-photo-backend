import type { Pagination } from '@shared/application'

export class GetUsersListQuery {
  constructor(
    public readonly pagination: Pagination,
    public readonly includeInactive: boolean = false,
    public readonly role?: string,
    public readonly search?: string,
  ) {}
}
