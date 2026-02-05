import type { Pagination } from '../../../../../shared/application/pagination.js'

export class GetEventsListQuery {
  constructor(public readonly pagination: Pagination) {}
}
