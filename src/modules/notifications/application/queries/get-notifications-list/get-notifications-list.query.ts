import type { Pagination } from '@shared/application'

export class GetNotificationsListQuery {
  constructor(
    public readonly userId: string,
    public readonly pagination: Pagination,
    public readonly isRead?: boolean,
  ) {}
}
