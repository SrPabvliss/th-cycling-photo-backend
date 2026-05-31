export const OrderStatus = {
  PENDING: 'pending',
  PAYMENT_INFO_SENT: 'payment_info_sent',
  PAID: 'paid',
  DELIVERED: 'delivered',
  CANCELLED: 'cancelled',
} as const

export type OrderStatusType = (typeof OrderStatus)[keyof typeof OrderStatus]
