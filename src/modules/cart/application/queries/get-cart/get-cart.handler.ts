import type { CartViewProjection } from '@cart/application/projections'
import { CART_READ_REPOSITORY, type ICartReadRepository } from '@cart/domain/ports'
import { Inject } from '@nestjs/common'
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs'
import { GetCartQuery } from './get-cart.query'

@QueryHandler(GetCartQuery)
export class GetCartHandler implements IQueryHandler<GetCartQuery> {
  constructor(@Inject(CART_READ_REPOSITORY) private readonly cartReadRepo: ICartReadRepository) {}

  async execute(query: GetCartQuery): Promise<CartViewProjection> {
    const cart = query.userId
      ? await this.cartReadRepo.findActiveByUserId(query.userId)
      : query.sessionId
        ? await this.cartReadRepo.findActiveBySessionId(query.sessionId)
        : null

    if (!cart) return []

    return this.cartReadRepo.getCartView(cart.id)
  }
}
