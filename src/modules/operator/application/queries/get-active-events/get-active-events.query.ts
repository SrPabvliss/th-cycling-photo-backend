import { Pagination } from '@shared/application'

export class GetActiveEventsQuery {
  constructor(
    public readonly operatorId: string,
    public readonly pagination: Pagination,
  ) {}
}
