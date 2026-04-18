import type { Pagination } from '@shared/application'

export class GetPreviewLinksListQuery {
  constructor(
    public readonly eventId: string,
    public readonly pagination: Pagination,
  ) {}
}
