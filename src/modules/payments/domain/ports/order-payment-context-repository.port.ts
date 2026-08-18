export type OrderPaymentContext = {
  orderId: string
  status: string
  subtotalDollars: number | null
  sellerUserId: string
  buyerUserId: string
}

export interface IOrderPaymentContextRepository {
  findByOrderId(orderId: string): Promise<OrderPaymentContext | null>
}

export const ORDER_PAYMENT_CONTEXT_REPOSITORY = Symbol('ORDER_PAYMENT_CONTEXT_REPOSITORY')
