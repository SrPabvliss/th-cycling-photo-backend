import { OrderStatus, type OrderStatusType } from '@orders/domain/value-objects/order-status.vo'

export const OrderSettlementDecision = {
  SETTLE: 'settle',
  ALREADY_SETTLED: 'already_settled',
  NOT_SETTLEABLE: 'not_settleable',
} as const

export type OrderSettlementDecisionType =
  (typeof OrderSettlementDecision)[keyof typeof OrderSettlementDecision]

export function decideOrderSettlement(status: OrderStatusType): OrderSettlementDecisionType {
  if (
    status === OrderStatus.DRAFT ||
    status === OrderStatus.PENDING ||
    status === OrderStatus.PAYMENT_INFO_SENT
  ) {
    return OrderSettlementDecision.SETTLE
  }

  if (status === OrderStatus.PAID || status === OrderStatus.DELIVERED) {
    return OrderSettlementDecision.ALREADY_SETTLED
  }

  return OrderSettlementDecision.NOT_SETTLEABLE
}
