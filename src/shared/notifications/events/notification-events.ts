export const NotificationEvent = {
  PREVIEW_VIEWED: 'preview.viewed',
  ORDER_CREATED: 'order.created',
  ORDER_PAID: 'order.paid',
} as const

export interface PreviewViewedPayload {
  previewLinkId: string
  eventName: string
  photoCount: number
  viewedAt: Date
}

export interface OrderCreatedPayload {
  orderId: string
  eventName: string
  customerName: string
  photoCount: number
  createdAt: Date
}

export interface OrderPaidPayload {
  orderId: string
  eventName: string
  customerName: string
  confirmedBy: string
  paidAt: Date
}
