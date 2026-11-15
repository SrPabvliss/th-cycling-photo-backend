import { OrderStatus } from '@orders/domain/value-objects/order-status.vo'

export const RefundReason = {
  ORDER_PAID: 'order_paid',
  ORDER_CANCELLED: 'order_cancelled',
  ORDER_GIFTED: 'order_gifted',
} as const

export type RefundReasonType = (typeof RefundReason)[keyof typeof RefundReason]

/**
 * Why a card charge the gateway just approved must be given back to the buyer for this order, or
 * null when the charge is the one that pays it.
 *
 * `paidByAnotherPayment` tells a paid order this charge paid (another confirmation of the same
 * charge got there first) from one paid some other way: staff confirming a transfer, or a
 * different card charge.
 */
export function refundReasonFor(
  orderStatus: string,
  paidByAnotherPayment: boolean,
): RefundReasonType | null {
  if (orderStatus === OrderStatus.CANCELLED) return RefundReason.ORDER_CANCELLED
  if (orderStatus === OrderStatus.GIFTED) return RefundReason.ORDER_GIFTED
  if (orderStatus === OrderStatus.PAID || orderStatus === OrderStatus.DELIVERED) {
    return paidByAnotherPayment ? RefundReason.ORDER_PAID : null
  }
  return null
}
