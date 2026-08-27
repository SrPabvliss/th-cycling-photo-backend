import type { IGalleryFilters } from '@photos/domain/ports'
import type { Pagination } from '@shared/application'

export class GetPhotosListQuery {
  constructor(
    public readonly eventId: string,
    public readonly pagination: Pagination,
    public readonly filters: IGalleryFilters,
    public readonly userId: string,
  ) {}
}
