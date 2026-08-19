import { OrderStatus, type OrderStatusType } from '@orders/domain/value-objects/order-status.vo'
import { decideOrderSettlement, OrderSettlementDecision } from './order-settlement-policy'

describe('decideOrderSettlement', () => {
  it('settles a draft order, since a card payment is exactly what a draft is for', () => {
    expect(decideOrderSettlement(OrderStatus.DRAFT)).toBe(OrderSettlementDecision.SETTLE)
  })

  it('settles a pending order', () => {
    expect(decideOrderSettlement(OrderStatus.PENDING)).toBe(OrderSettlementDecision.SETTLE)
  })

  it('settles an order whose payment info was sent', () => {
    expect(decideOrderSettlement(OrderStatus.PAYMENT_INFO_SENT)).toBe(
      OrderSettlementDecision.SETTLE,
    )
  })

  it('reports an already-paid order as already settled', () => {
    expect(decideOrderSettlement(OrderStatus.PAID)).toBe(OrderSettlementDecision.ALREADY_SETTLED)
  })

  it('reports a delivered order as already settled', () => {
    expect(decideOrderSettlement(OrderStatus.DELIVERED)).toBe(
      OrderSettlementDecision.ALREADY_SETTLED,
    )
  })

  it('reports a gifted order as not settleable', () => {
    expect(decideOrderSettlement(OrderStatus.GIFTED)).toBe(OrderSettlementDecision.NOT_SETTLEABLE)
  })

  it('reports a cancelled order as not settleable', () => {
    expect(decideOrderSettlement(OrderStatus.CANCELLED)).toBe(
      OrderSettlementDecision.NOT_SETTLEABLE,
    )
  })

  it('classifies every OrderStatus value into exactly one decision', () => {
    const statuses = Object.values(OrderStatus) as OrderStatusType[]
    const decisions = statuses.map((status) => decideOrderSettlement(status))

    expect(decisions).toEqual([
      OrderSettlementDecision.SETTLE,
      OrderSettlementDecision.SETTLE,
      OrderSettlementDecision.SETTLE,
      OrderSettlementDecision.ALREADY_SETTLED,
      OrderSettlementDecision.ALREADY_SETTLED,
      OrderSettlementDecision.NOT_SETTLEABLE,
      OrderSettlementDecision.NOT_SETTLEABLE,
    ])
  })
})
