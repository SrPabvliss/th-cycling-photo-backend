import type { Pagination } from '@shared/application'

export class GetPhotosListQuery {
  constructor(
    public readonly eventId: string,
    public readonly pagination: Pagination,
  ) {}
}
