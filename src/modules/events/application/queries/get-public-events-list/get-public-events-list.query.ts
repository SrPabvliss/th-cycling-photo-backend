import type { Pagination } from '@shared/application'

export class GetPublicEventsListQuery {
  constructor(public readonly pagination: Pagination) {}
}
