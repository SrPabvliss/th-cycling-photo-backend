import type { Pagination } from '@shared/application'

export interface SearchPhotosFilters {
  eventId?: string
  status?: string
  plateNumber?: number
  fromDate?: Date
  toDate?: Date
}

export class SearchPhotosQuery {
  constructor(
    public readonly filters: SearchPhotosFilters,
    public readonly pagination: Pagination,
  ) {}
}
