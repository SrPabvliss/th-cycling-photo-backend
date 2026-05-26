import type { Pagination } from '@shared/application'

export class GetPublicEventPhotosQuery {
  constructor(
    public readonly slug: string,
    public readonly pagination: Pagination,
    public readonly photoCategoryId: number | null,
    public readonly bibNumber: string | null,
    public readonly bibMatch: 'exact' | 'starts' | 'contains',
    public readonly section: 'matched' | 'no_bib' | null,
  ) {}
}
