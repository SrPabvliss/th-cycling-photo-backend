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
import { CancelMyOrderCommand } from './cancel-my-order.command'

@CommandHandler(CancelMyOrderCommand)
export class CancelMyOrderHandler implements ICommandHandler<CancelMyOrderCommand> {
  constructor(
    @Inject(ORDER_READ_REPOSITORY) private readonly readRepo: IOrderReadRepository,
    @Inject(ORDER_WRITE_REPOSITORY) private readonly writeRepo: IOrderWriteRepository,
  ) {}

  async execute(command: CancelMyOrderCommand): Promise<EntityIdProjection> {
    const order = await this.readRepo.findById(command.orderId)
    if (!order || order.userId !== command.userId) {
      throw AppException.notFound('entities.order', command.orderId)
    }

    if (await this.readRepo.hasPaymentInFlight(command.orderId)) {
      throw AppException.businessRule('order.payment_in_progress')
    }

    order.cancelByOwner()
    await this.writeRepo.save(order)

    return { id: order.id }
  }
}
