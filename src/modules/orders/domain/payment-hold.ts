/** Card payment states in which the charge may still land on the order. */
const IN_FLIGHT = new Set(['initiated', 'confirming'])
const APPROVED = 'approved'

/** The order's card payments as a cancellation sees them, under their lock. */
export interface OrderPayments {
  statuses: readonly string[]
  /**
   * A confirmation holds one of them right now (Payphone is being asked, or its answer recorded),
   * so its status is about to change and cannot be trusted.
   */
  beingConfirmed: boolean
}

/**
 * Whether a card payment still holds the order, so it cannot be cancelled yet: a confirmation is
 * running, the buyer is at the gateway or coming back from it, or the gateway approved the charge
 * and the order has not been marked paid yet. Cancelling in that window would leave a charged buyer
 * with a cancelled order.
 */
export function isHeldByPayment(order: { isPaid: boolean }, payments: OrderPayments): boolean {
  if (payments.beingConfirmed) return true
  return payments.statuses.some(
    (status) => IN_FLIGHT.has(status) || (status === APPROVED && !order.isPaid),
  )
}
