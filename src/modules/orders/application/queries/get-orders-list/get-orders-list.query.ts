import type { OrderListFilters } from '@orders/domain/ports'
import type { Pagination } from '@shared/application'

export class GetOrdersListQuery {
  constructor(
    public readonly pagination: Pagination,
    public readonly filters: OrderListFilters,
  ) {}
}
