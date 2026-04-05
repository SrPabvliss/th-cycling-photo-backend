import type { CartSummaryProjection } from '@cart/application/projections'
import {
  CART_READ_REPOSITORY,
  CART_WRITE_REPOSITORY,
  type ICartReadRepository,
  type ICartWriteRepository,
} from '@cart/domain/ports'
import { Inject } from '@nestjs/common'
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs'
import { AppException } from '@shared/domain'
import { RemoveFromCartCommand } from './remove-from-cart.command'

@CommandHandler(RemoveFromCartCommand)
export class RemoveFromCartHandler implements ICommandHandler<RemoveFromCartCommand> {
  constructor(
    @Inject(CART_READ_REPOSITORY) private readonly cartReadRepo: ICartReadRepository,
    @Inject(CART_WRITE_REPOSITORY) private readonly cartWriteRepo: ICartWriteRepository,
  ) {}

  async execute(command: RemoveFromCartCommand): Promise<CartSummaryProjection> {
    const cart = command.userId
      ? await this.cartReadRepo.findActiveByUserId(command.userId)
      : command.sessionId
        ? await this.cartReadRepo.findActiveBySessionId(command.sessionId)
        : null

    if (!cart) throw AppException.businessRule('cart.no_active_cart')

    return this.cartWriteRepo.removeItem(cart.id, command.photoId)
  }
}
