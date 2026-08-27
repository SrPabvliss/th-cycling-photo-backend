export const NotificationEvent = {
  PREVIEW_VIEWED: 'preview.viewed',
  ORDER_CREATED: 'order.created',
  ORDER_PAID: 'order.paid',
  ORDER_DELIVERED: 'order.delivered',
  ORDER_RETOUCH_COMPLETED: 'order.retouch_completed',
  TENANT_CONTRACT_ACCEPTED: 'tenant_contract.accepted',
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
  subtotal?: number | null
  currency?: string | null
  createdAt: Date
  actorUserId?: string
}

export interface OrderPaidPayload {
  orderId: string
  eventId: string
  eventName: string
  customerName: string
  confirmedBy: string
  photoCount: number
  paidAt: Date
}

export interface OrderDeliveredPayload {
  orderId: string
  eventName: string
  customerName: string
  deliveredAt: Date
  actorUserId?: string
}

export interface OrderRetouchCompletedPayload {
  orderId: string
  eventId: string
  eventName: string
  customerName: string
  photoCount: number
  completedAt: Date
}

export interface TenantContractAcceptedPayload {
  contractId: string
  commercialName: string
  tenantCreated: boolean
  acceptedBy: string
}
