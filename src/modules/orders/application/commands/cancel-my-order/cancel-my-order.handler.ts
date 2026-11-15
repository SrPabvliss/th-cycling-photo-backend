import { Inject } from '@nestjs/common'
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs'
import { isHeldByPayment } from '@orders/domain/payment-hold'
import { type IOrderWriteRepository, ORDER_WRITE_REPOSITORY } from '@orders/domain/ports'
import type { EntityIdProjection } from '@shared/application'
import { AppException } from '@shared/domain'
import { PrismaService } from '@shared/infrastructure'
import { CancelMyOrderCommand } from './cancel-my-order.command'

@CommandHandler(CancelMyOrderCommand)
export class CancelMyOrderHandler implements ICommandHandler<CancelMyOrderCommand> {
  constructor(
    @Inject(ORDER_WRITE_REPOSITORY) private readonly writeRepo: IOrderWriteRepository,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Cancels the order once, whatever runs at the same time: staff confirming the transfer, or the
   * buyer's card payment coming back from the gateway.
   *
   * The order and its card payments are locked and read again in the transaction that cancels it.
   * A payment confirmed first is found here (`order.not_cancellable_by_owner`). A card payment that
   * a confirmation holds right now, or one still in flight or approved but not yet settled, holds
   * the order (`order.payment_in_progress`), answered at once rather than after Payphone does.
   * A cancellation committed first makes the payment run find the order cancelled instead.
   */
  async execute(command: CancelMyOrderCommand): Promise<EntityIdProjection> {
    const cancelled = await this.prisma.$transaction(async (tx) => {
      const order = await this.writeRepo.findByIdForUpdate(command.orderId, tx)
      if (!order || order.userId !== command.userId) {
        throw AppException.notFound('entities.order', command.orderId)
      }

      const payments = await this.writeRepo.findPaymentsForUpdate(order.id, tx)
      if (isHeldByPayment(order, payments)) {
        throw AppException.businessRule('order.payment_in_progress')
      }

      order.cancelByOwner()
      await this.writeRepo.save(order, tx)
      return order
    })

    return { id: cancelled.id }
  }
}
