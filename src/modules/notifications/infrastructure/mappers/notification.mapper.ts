import type { Notification as PrismaNotification } from '@generated/prisma/client'
import type { NotificationProjection } from '@notifications/application/projections'

export function toProjection(record: PrismaNotification): NotificationProjection {
  return {
    id: record.id,
    type: record.type,
    title: record.title,
    message: record.message,
    data: record.data as Record<string, unknown>,
    isRead: record.is_read,
    createdAt: record.created_at,
    readAt: record.read_at,
  }
}
