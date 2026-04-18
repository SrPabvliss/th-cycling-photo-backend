import type { Prisma } from '@generated/prisma/client'
import { Injectable } from '@nestjs/common'
import type { NotificationProjection } from '@notifications/application/projections'
import type { INotificationReadRepository } from '@notifications/domain/ports'
import { PaginatedResult, type Pagination } from '@shared/application'
import { PrismaService } from '@shared/infrastructure'
import * as NotificationMapper from '../mappers/notification.mapper'

@Injectable()
export class NotificationReadRepository implements INotificationReadRepository {
  constructor(private readonly prisma: PrismaService) {}

  async getList(
    userId: string,
    pagination: Pagination,
    isRead?: boolean,
  ): Promise<PaginatedResult<NotificationProjection>> {
    const where: Prisma.NotificationWhereInput = { user_id: userId }
    if (isRead !== undefined) where.is_read = isRead

    const [notifications, total] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip: pagination.skip,
        take: pagination.take,
      }),
      this.prisma.notification.count({ where }),
    ])

    return new PaginatedResult(
      notifications.map((n) => NotificationMapper.toProjection(n)),
      total,
      pagination,
    )
  }

  async getUnreadCount(userId: string): Promise<number> {
    return this.prisma.notification.count({
      where: { user_id: userId, is_read: false },
    })
  }
}
