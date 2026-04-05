import type { CartSummaryProjection } from '@cart/application/projections'

export interface ICartWriteRepository {
  createCart(data: { userId?: string; sessionId?: string; expiresAt: Date }): Promise<string>
  addItem(cartId: string, photoId: string, eventId: string): Promise<CartSummaryProjection>
  removeItem(cartId: string, photoId: string): Promise<CartSummaryProjection>
  mergeAnonymousToUser(sessionCartId: string, userCartId: string): Promise<number>
  transferCartToUser(cartId: string, userId: string): Promise<void>
  markConverted(cartId: string): Promise<void>
}

export const CART_WRITE_REPOSITORY = Symbol('CART_WRITE_REPOSITORY')
