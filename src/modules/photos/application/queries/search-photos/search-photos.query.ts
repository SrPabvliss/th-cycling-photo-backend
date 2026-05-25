import type { Pagination } from '@shared/application'

export interface SearchPhotosFilters {
  eventId?: string
  status?: string
  plateNumber?: string
  bibMatch?: 'exact' | 'starts' | 'contains'
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
