import type { Pagination } from '@shared/application'

export class GetPublicEventPhotosQuery {
  constructor(
    public readonly slug: string,
    public readonly pagination: Pagination,
    public readonly photoCategoryId: number | null,
  ) {}
}
