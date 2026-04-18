import type {
  ActiveCartProjection,
  CartItemsByEventProjection,
  CartSummaryProjection,
  CartViewProjection,
} from '@cart/application/projections'

export interface ICartReadRepository {
  findActiveByUserId(userId: string): Promise<ActiveCartProjection | null>
  findActiveBySessionId(sessionId: string): Promise<ActiveCartProjection | null>
  getCartView(cartId: string): Promise<CartViewProjection>
  getCartItemsByEvent(cartId: string): Promise<CartItemsByEventProjection[]>
  getCartSummary(cartId: string): Promise<CartSummaryProjection>
}

export const CART_READ_REPOSITORY = Symbol('CART_READ_REPOSITORY')
