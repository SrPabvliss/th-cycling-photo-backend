export type OrderPaymentContext = {
  orderId: string
  eventId: string
  status: string
  /** How the buyer chose to pay; null on orders placed before it was recorded (all transfers). */
  paymentMethod: string | null
  subtotalDollars: number | null
  sellerTenantId: string | null
  buyerUserId: string
  /** Who settled the order: the payment system account for a card, a staff member for a transfer. */
  confirmedById: string | null
}

export interface IOrderPaymentContextRepository {
  findByOrderIds(orderIds: string[]): Promise<OrderPaymentContext[]>
}

export const ORDER_PAYMENT_CONTEXT_REPOSITORY = Symbol('ORDER_PAYMENT_CONTEXT_REPOSITORY')
