import { Inject } from '@nestjs/common'
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs'
import {
  type IOrderReadRepository,
  type IOrderWriteRepository,
  ORDER_READ_REPOSITORY,
  ORDER_WRITE_REPOSITORY,
} from '@orders/domain/ports'
import type { EntityIdProjection } from '@shared/application'
import { AppException } from '@shared/domain'
import { GiftOrderCommand } from './gift-order.command'

@CommandHandler(GiftOrderCommand)
export class GiftOrderHandler implements ICommandHandler<GiftOrderCommand> {
  constructor(
    @Inject(ORDER_WRITE_REPOSITORY)
    private readonly writeRepo: IOrderWriteRepository,
    @Inject(ORDER_READ_REPOSITORY)
    private readonly readRepo: IOrderReadRepository,
  ) {}

  async execute(command: GiftOrderCommand): Promise<EntityIdProjection> {
    const order = await this.readRepo.findById(command.orderId)
    if (!order) throw AppException.notFound('entities.order', command.orderId)

    order.markAsGift(command.audit.userId)
    await this.writeRepo.save(order)

    return { id: order.id }
  }
}
