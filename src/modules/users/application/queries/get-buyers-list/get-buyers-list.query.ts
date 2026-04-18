import type { Pagination } from '@shared/application'

export class GetBuyersListQuery {
  constructor(
    public readonly pagination: Pagination,
    public readonly search?: string,
  ) {}
}
