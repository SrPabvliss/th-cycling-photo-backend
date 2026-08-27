import type { BuyerListFilters } from '@users/domain/ports'

export class GetBuyersStatsQuery {
  constructor(public readonly filters: BuyerListFilters) {}
}
