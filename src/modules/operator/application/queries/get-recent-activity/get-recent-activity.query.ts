import { Pagination } from '@shared/application'

export class GetRecentActivityQuery {
  constructor(
    public readonly operatorId: string,
    public readonly pagination: Pagination,
    public readonly lang: string,
  ) {}
}
