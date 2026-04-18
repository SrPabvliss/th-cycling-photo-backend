import type { NotificationProjection } from '@notifications/application/projections'
import type { PaginatedResult, Pagination } from '@shared/application'

export interface INotificationReadRepository {
  getList(
    userId: string,
    pagination: Pagination,
    isRead?: boolean,
  ): Promise<PaginatedResult<NotificationProjection>>
  getUnreadCount(userId: string): Promise<number>
}

export const NOTIFICATION_READ_REPOSITORY = Symbol('NOTIFICATION_READ_REPOSITORY')
