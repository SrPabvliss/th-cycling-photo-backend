import type { Pagination } from '@shared/application'

export interface SearchPhotosFilters {
  eventId?: string
  status?: string
  plateNumber?: number
  helmetColor?: string
  clothingColor?: string
  bikeColor?: string
  fromDate?: Date
  toDate?: Date
}

export class SearchPhotosQuery {
  constructor(
    public readonly filters: SearchPhotosFilters,
    public readonly pagination: Pagination,
  ) {}
}
