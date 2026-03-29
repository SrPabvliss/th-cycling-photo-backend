import type { Prisma } from '@generated/prisma/client'
import { Injectable } from '@nestjs/common'
import type {
  CreateNotificationData,
  INotificationWriteRepository,
} from '@notifications/domain/ports'
import { PrismaService } from '@shared/infrastructure'

@Injectable()
export class NotificationWriteRepository implements INotificationWriteRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createMany(notifications: CreateNotificationData[]): Promise<string[]> {
    const created = await Promise.all(
      notifications.map((n) =>
        this.prisma.notification.create({
          data: {
            user_id: n.userId,
            type: n.type,
            title: n.title,
            message: n.message,
            data: n.data as Prisma.InputJsonValue,
          },
          select: { id: true },
        }),
      ),
    )
    return created.map((c) => c.id)
  }

  async markAsRead(userId: string, notificationId: string): Promise<void> {
    await this.prisma.notification.updateMany({
      where: { id: notificationId, user_id: userId },
      data: { is_read: true, read_at: new Date() },
    })
  }

  async markAllAsRead(userId: string): Promise<number> {
    const result = await this.prisma.notification.updateMany({
      where: { user_id: userId, is_read: false },
      data: { is_read: true, read_at: new Date() },
    })
    return result.count
  }
}
