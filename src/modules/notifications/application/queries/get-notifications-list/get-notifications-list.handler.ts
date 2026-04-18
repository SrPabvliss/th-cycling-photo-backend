import { Inject } from '@nestjs/common'
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs'
import type { NotificationProjection } from '@notifications/application/projections'
import {
  type INotificationReadRepository,
  NOTIFICATION_READ_REPOSITORY,
} from '@notifications/domain/ports'
import type { PaginatedResult } from '@shared/application'
import { GetNotificationsListQuery } from './get-notifications-list.query'

@QueryHandler(GetNotificationsListQuery)
export class GetNotificationsListHandler implements IQueryHandler<GetNotificationsListQuery> {
  constructor(
    @Inject(NOTIFICATION_READ_REPOSITORY)
    private readonly readRepo: INotificationReadRepository,
  ) {}

  async execute(
    query: GetNotificationsListQuery,
  ): Promise<PaginatedResult<NotificationProjection>> {
    return this.readRepo.getList(query.userId, query.pagination, query.isRead)
  }
}
