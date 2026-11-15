export type OrderPaymentContext = {
  orderId: string
  eventId: string
  status: string
  /** How the buyer chose to pay; null on orders placed before it was recorded (all transfers). */
  paymentMethod: string | null
  subtotalDollars: number | null
  sellerTenantId: string | null
  buyerUserId: string
}

export interface IOrderPaymentContextRepository {
  findByOrderIds(orderIds: string[]): Promise<OrderPaymentContext[]>
}

export const ORDER_PAYMENT_CONTEXT_REPOSITORY = Symbol('ORDER_PAYMENT_CONTEXT_REPOSITORY')
