export type CreateNotificationData = {
  userId: string
  type: string
  title: string
  message: string
  data: Record<string, unknown>
}

export interface INotificationWriteRepository {
  createMany(notifications: CreateNotificationData[]): Promise<string[]>
  markAsRead(userId: string, notificationId: string): Promise<void>
  markAllAsRead(userId: string): Promise<number>
}

export const NOTIFICATION_WRITE_REPOSITORY = Symbol('NOTIFICATION_WRITE_REPOSITORY')
