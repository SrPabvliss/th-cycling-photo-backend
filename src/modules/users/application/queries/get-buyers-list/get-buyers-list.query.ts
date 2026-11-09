import type { Pagination } from '@shared/application'
import type { BuyerListFilters } from '@users/domain/ports'

export class GetBuyersListQuery {
  constructor(
    public readonly pagination: Pagination,
    public readonly filters: BuyerListFilters,
  ) {}
}
