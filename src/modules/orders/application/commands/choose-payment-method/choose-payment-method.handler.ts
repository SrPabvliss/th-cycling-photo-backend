import { Inject } from '@nestjs/common'
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs'
import { NotificationsService } from '@notifications/application/services/notifications.service'
import type { Order } from '@orders/domain/entities'
import {
  type IOrderReadRepository,
  type IOrderWriteRepository,
  ORDER_READ_REPOSITORY,
  ORDER_WRITE_REPOSITORY,
} from '@orders/domain/ports'
import { PaymentMethod } from '@orders/domain/value-objects/payment-method.vo'
import {
  type IPaymentTransactionWriteRepository,
  PAYMENT_TRANSACTION_WRITE_REPOSITORY,
} from '@payments/domain/ports'
import { EventScope } from '@shared/authorization/domain/event-scope.vo'
import { AppException } from '@shared/domain'
import { ChoosePaymentMethodCommand } from './choose-payment-method.command'

@CommandHandler(ChoosePaymentMethodCommand)
export class ChoosePaymentMethodHandler implements ICommandHandler<ChoosePaymentMethodCommand> {
  constructor(
    @Inject(ORDER_WRITE_REPOSITORY) private readonly writeRepo: IOrderWriteRepository,
    @Inject(ORDER_READ_REPOSITORY) private readonly readRepo: IOrderReadRepository,
    @Inject(PAYMENT_TRANSACTION_WRITE_REPOSITORY)
    private readonly transactionWriteRepo: IPaymentTransactionWriteRepository,
    private readonly notifications: NotificationsService,
  ) {}

  async execute(command: ChoosePaymentMethodCommand): Promise<{ orderIds: string[] }> {
    const orders = await Promise.all(command.orderIds.map((id) => this.readRepo.findById(id)))

    const missing = command.orderIds.filter((_, index) => orders[index] === null)
    if (missing.length > 0) throw AppException.notFound('entities.order', missing[0])

    const found = orders as NonNullable<(typeof orders)[number]>[]
    if (found.some((order) => order.userId !== command.buyerUserId)) {
      throw AppException.forbidden('payment.order_not_yours')
    }

    const promoted: Order[] = []

    found.forEach((order) => {
      order.choosePaymentMethod(command.method)
      if (command.method === PaymentMethod.TRANSFER && order.isDraft) {
        order.confirmDraftAsPending()
        promoted.push(order)
      }
    })
    await Promise.all(found.map((order) => this.writeRepo.save(order)))

    await Promise.all(
      promoted.map(async (order) => {
        await this.transactionWriteRepo.expireOpenByOrderId(order.id)

        // Ownership, not tenant scope, is the boundary here: the buyer was verified against
        // `order.userId` above, and a customer's own EventScope is empty so it would match nothing.
        const detail = await this.readRepo.getDetail(order.id, EventScope.unrestricted())
        if (!detail) return

        this.notifications.emitOrderCreated({
          orderId: order.id,
          eventName: detail.eventName,
          customerName: detail.userName,
          photoCount: detail.photos.length,
          subtotal: detail.subtotal !== null ? Number(detail.subtotal) : null,
          currency: detail.snapCurrency,
          createdAt: order.createdAt,
          actorUserId: order.userId,
        })
      }),
    )

    return { orderIds: command.orderIds }
  }
}
