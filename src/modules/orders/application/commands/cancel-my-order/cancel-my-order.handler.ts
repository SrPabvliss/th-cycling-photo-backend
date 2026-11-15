import { Inject, Logger } from '@nestjs/common'
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs'
import { NotificationsService } from '@notifications/application/services/notifications.service'
import { isHeldByPayment } from '@orders/domain/payment-hold'
import {
  type IOrderReadRepository,
  type IOrderWriteRepository,
  ORDER_READ_REPOSITORY,
  ORDER_WRITE_REPOSITORY,
} from '@orders/domain/ports'
import { OrderStatus } from '@orders/domain/value-objects/order-status.vo'
import type { EntityIdProjection } from '@shared/application'
import { EventScope } from '@shared/authorization/domain/event-scope.vo'
import { AppException } from '@shared/domain'
import { PrismaService } from '@shared/infrastructure'
import { CancelMyOrderCommand } from './cancel-my-order.command'

@CommandHandler(CancelMyOrderCommand)
export class CancelMyOrderHandler implements ICommandHandler<CancelMyOrderCommand> {
  private readonly logger = new Logger(CancelMyOrderHandler.name)

  constructor(
    @Inject(ORDER_WRITE_REPOSITORY) private readonly writeRepo: IOrderWriteRepository,
    private readonly prisma: PrismaService,
    @Inject(ORDER_READ_REPOSITORY) private readonly readRepo: IOrderReadRepository,
    private readonly notifications: NotificationsService,
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
    let hadPaymentDetails = false
    const cancelled = await this.prisma.$transaction(async (tx) => {
      const order = await this.writeRepo.findByIdForUpdate(command.orderId, tx)
      if (!order || order.userId !== command.userId) {
        throw AppException.notFound('entities.order', command.orderId)
      }

      const payments = await this.writeRepo.findPaymentsForUpdate(order.id, tx)
      if (isHeldByPayment(order, payments)) {
        throw AppException.businessRule('order.payment_in_progress')
      }

      hadPaymentDetails = order.status === OrderStatus.PAYMENT_INFO_SENT
      order.cancelByOwner()
      await this.writeRepo.save(order, tx)
      return order
    })

    if (hadPaymentDetails) await this.tellStaff(cancelled.id, command.userId)

    return { id: cancelled.id }
  }

  /**
   * Staff had sent where to transfer, so the buyer may already have paid: they are told, once the
   * cancellation is committed, to give back a transfer that arrives for it. Before that point there
   * is nothing to give back, and telling them would be noise. A failure here never undoes the
   * cancellation; it is logged.
   */
  private async tellStaff(orderId: string, buyerUserId: string): Promise<void> {
    try {
      // Ownership was checked under the lock; a buyer's own EventScope is empty.
      const detail = await this.readRepo.getDetail(orderId, EventScope.unrestricted())
      if (!detail) return

      this.notifications.emitOrderCancelledByBuyer({
        orderId,
        eventId: detail.eventId,
        eventName: detail.eventName,
        customerName: detail.userName,
        photoCount: detail.photos.length,
        subtotal: detail.subtotal !== null ? Number(detail.subtotal) : null,
        currency: detail.snapCurrency,
        cancelledAt: new Date(),
        actorUserId: buyerUserId,
      })
    } catch (error) {
      this.logger.error(
        `A buyer cancelled after the payment details were sent, but staff could not be told. orderId=${orderId} reason=${error instanceof Error ? error.message : String(error)}`,
      )
    }
  }
}
