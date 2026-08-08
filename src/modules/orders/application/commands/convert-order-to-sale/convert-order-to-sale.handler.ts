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
import { ConvertOrderToSaleCommand } from './convert-order-to-sale.command'

@CommandHandler(ConvertOrderToSaleCommand)
export class ConvertOrderToSaleHandler implements ICommandHandler<ConvertOrderToSaleCommand> {
  constructor(
    @Inject(ORDER_WRITE_REPOSITORY)
    private readonly writeRepo: IOrderWriteRepository,
    @Inject(ORDER_READ_REPOSITORY)
    private readonly readRepo: IOrderReadRepository,
  ) {}

  async execute(command: ConvertOrderToSaleCommand): Promise<EntityIdProjection> {
    const order = await this.readRepo.findById(command.orderId)
    if (!order) throw AppException.notFound('entities.order', command.orderId)

    order.convertToSale(command.audit.userId)
    await this.writeRepo.save(order)

    return { id: order.id }
  }
}
