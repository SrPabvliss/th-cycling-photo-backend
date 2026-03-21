import type { Pagination } from '@shared/application'

export class GetCustomersListQuery {
  constructor(
    public readonly pagination: Pagination,
    public readonly search?: string,
  ) {}
}
