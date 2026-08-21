import type { Pagination } from '@shared/application'

export class GetPhotosListQuery {
  constructor(
    public readonly eventId: string,
    public readonly pagination: Pagination,
    public readonly classified: boolean | undefined,
    public readonly photoCategoryId: number | undefined,
    public readonly userId: string,
  ) {}
}
