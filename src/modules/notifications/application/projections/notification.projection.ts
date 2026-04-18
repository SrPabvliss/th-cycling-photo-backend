export class NotificationProjection {
  id: string
  type: string
  title: string
  message: string
  data: Record<string, unknown>
  isRead: boolean
  createdAt: Date
  readAt: Date | null
}
