import type { Pagination } from '@shared/application'

export class GetMyOrdersListQuery {
  constructor(
    public readonly userId: string,
    public readonly pagination: Pagination,
  ) {}
}
