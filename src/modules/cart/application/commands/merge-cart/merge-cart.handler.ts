import type { MergeResultProjection } from '@cart/application/projections'
import {
  CART_READ_REPOSITORY,
  CART_WRITE_REPOSITORY,
  type ICartReadRepository,
  type ICartWriteRepository,
} from '@cart/domain/ports'
import { Inject } from '@nestjs/common'
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs'
import { MergeCartCommand } from './merge-cart.command'

@CommandHandler(MergeCartCommand)
export class MergeCartHandler implements ICommandHandler<MergeCartCommand> {
  constructor(
    @Inject(CART_READ_REPOSITORY) private readonly cartReadRepo: ICartReadRepository,
    @Inject(CART_WRITE_REPOSITORY) private readonly cartWriteRepo: ICartWriteRepository,
  ) {}

  async execute(command: MergeCartCommand): Promise<MergeResultProjection> {
    const sessionCart = await this.cartReadRepo.findActiveBySessionId(command.sessionId)
    const userCart = await this.cartReadRepo.findActiveByUserId(command.userId)

    // No anonymous cart — nothing to merge
    if (!sessionCart) return { mergedCount: 0 }

    if (userCart) {
      // Both exist: merge session items into user cart, mark session cart converted
      const mergedCount = await this.cartWriteRepo.mergeAnonymousToUser(sessionCart.id, userCart.id)
      return { mergedCount }
    }

    // Only anonymous cart exists: transfer ownership to user
    await this.cartWriteRepo.transferCartToUser(sessionCart.id, command.userId)
    const summary = await this.cartReadRepo.getCartSummary(sessionCart.id)
    return { mergedCount: summary.itemCount }
  }
}
