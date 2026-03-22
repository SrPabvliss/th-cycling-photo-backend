export const OrderStatus = {
  PENDING: 'pending',
  PAID: 'paid',
  DELIVERED: 'delivered',
  CANCELLED: 'cancelled',
} as const

export type OrderStatusType = (typeof OrderStatus)[keyof typeof OrderStatus]
