import { Inject } from '@nestjs/common'
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs'
import type { UnreadCountProjection } from '@notifications/application/projections'
import {
  type INotificationReadRepository,
  NOTIFICATION_READ_REPOSITORY,
} from '@notifications/domain/ports'
import { GetUnreadCountQuery } from './get-unread-count.query'

@QueryHandler(GetUnreadCountQuery)
export class GetUnreadCountHandler implements IQueryHandler<GetUnreadCountQuery> {
  constructor(
    @Inject(NOTIFICATION_READ_REPOSITORY)
    private readonly readRepo: INotificationReadRepository,
  ) {}

  async execute(query: GetUnreadCountQuery): Promise<UnreadCountProjection> {
    const count = await this.readRepo.getUnreadCount(query.userId)
    return { count }
  }
}
