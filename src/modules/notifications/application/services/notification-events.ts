export const NotificationEvent = {
  PREVIEW_VIEWED: 'preview.viewed',
  ORDER_CREATED: 'order.created',
  ORDER_PAID: 'order.paid',
  ORDER_DELIVERED: 'order.delivered',
  ORDER_RETOUCH_COMPLETED: 'order.retouch_completed',
  TENANT_CONTRACT_ACCEPTED: 'tenant_contract.accepted',
  ORDER_CANCELLED_BY_BUYER: 'order.cancelled_by_buyer',
  PAYMENT_NEEDS_REFUND: 'payment.needs_refund',
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

/**
 * A buyer cancelled an order after staff had sent where to transfer: the money may already be on
 * its way, so staff must give back a transfer that arrives for it.
 */
export interface OrderCancelledByBuyerPayload {
  orderId: string
  eventId: string
  eventName: string
  customerName: string
  photoCount: number
  subtotal: number | null
  currency: string | null
  cancelledAt: Date
  actorUserId: string
}

/**
 * A card charge the gateway approved for an order that could not take it: already paid some
 * other way, cancelled or gifted. The money was taken, so staff must refund it.
 */
export interface PaymentNeedsRefundPayload {
  clientTransactionId: string
  orderId: string
  eventId: string
  orderStatus: string
  reason: 'order_paid' | 'order_cancelled' | 'order_gifted'
  /** What the gateway charged for the whole transaction, which may cover several orders. */
  amountCents: number
  approvedAt: Date
}
