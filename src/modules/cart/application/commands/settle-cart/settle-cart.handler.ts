import {
  CART_READ_REPOSITORY,
  CART_WRITE_REPOSITORY,
  type ICartReadRepository,
  type ICartWriteRepository,
} from '@cart/domain/ports'
import { Inject } from '@nestjs/common'
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs'
import { type IOrderReadRepository, ORDER_READ_REPOSITORY } from '@orders/domain/ports'
import { SettleCartCommand } from './settle-cart.command'

@CommandHandler(SettleCartCommand)
export class SettleCartHandler implements ICommandHandler<SettleCartCommand> {
  constructor(
    @Inject(CART_READ_REPOSITORY) private readonly cartReadRepo: ICartReadRepository,
    @Inject(CART_WRITE_REPOSITORY) private readonly cartWriteRepo: ICartWriteRepository,
    @Inject(ORDER_READ_REPOSITORY) private readonly orderReadRepo: IOrderReadRepository,
  ) {}

  async execute(command: SettleCartCommand): Promise<void> {
    const cart = await this.cartReadRepo.findActiveByUserId(command.userId)
    if (!cart) return

    const photoIds = await this.orderReadRepo.getPhotoIdsByOrderIds(command.orderIds)
    if (photoIds.length === 0) return

    await this.cartWriteRepo.removeItems(cart.id, photoIds)

    const summary = await this.cartReadRepo.getCartSummary(cart.id)
    if (summary.itemCount === 0) {
      await this.cartWriteRepo.markConverted(cart.id)
    }
  }
}
