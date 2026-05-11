import { Pagination } from '@shared/application'

export class GetCompletedEventsQuery {
  constructor(
    public readonly operatorId: string,
    public readonly pagination: Pagination,
  ) {}
}
