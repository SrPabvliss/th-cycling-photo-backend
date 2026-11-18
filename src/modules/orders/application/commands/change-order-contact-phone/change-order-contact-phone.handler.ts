import { Inject } from '@nestjs/common'
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs'
import { type IOrderReadRepository, ORDER_READ_REPOSITORY } from '@orders/domain/ports'
import {
  AUTHORIZATION_SERVICE,
  type IAuthorizationService,
} from '@shared/authorization/domain/ports/authorization.service.port'
import { AppException } from '@shared/domain'
import { PrismaService } from '@shared/infrastructure'
import { OrderContactService } from '@shared/order-contact'
import { ChangeOrderContactPhoneCommand } from './change-order-contact-phone.command'
import type { OrderContactPhoneChangedProjection } from './change-order-contact-phone.projection'

/**
 * The operator who writes to the buyer often knows their real number when the one on the order is
 * wrong. They fix it here, on the order they are looking at, instead of asking for a change in the
 * database: the order takes it, the buyer's other orders in progress too, and so does the account
 * unless told otherwise.
 */
@CommandHandler(ChangeOrderContactPhoneCommand)
export class ChangeOrderContactPhoneHandler
  implements ICommandHandler<ChangeOrderContactPhoneCommand>
{
  constructor(
    @Inject(ORDER_READ_REPOSITORY) private readonly readRepo: IOrderReadRepository,
    @Inject(AUTHORIZATION_SERVICE) private readonly authz: IAuthorizationService,
    private readonly orderContact: OrderContactService,
    private readonly prisma: PrismaService,
  ) {}

  async execute(
    command: ChangeOrderContactPhoneCommand,
  ): Promise<OrderContactPhoneChangedProjection> {
    const scope = await this.authz.resolveEventScope(command.audit.userId, 'order.notify_payment')
    const order = await this.readRepo.findByIdInScope(command.orderId, scope)
    if (!order) throw AppException.notFound('entities.order', command.orderId)
    await this.authz.assert(command.audit.userId, 'order.notify_payment', order.eventId)

    const updatedOrders = await this.prisma.$transaction(async (tx) => {
      if (command.updateAccount) {
        await this.orderContact.setAccountPrimaryPhone(tx, order.userId, command.phoneNumber)
      }
      return this.orderContact.correctFromOrder(
        tx,
        { id: order.id, userId: order.userId },
        command.phoneNumber,
        { changedById: command.audit.userId, source: 'admin' },
      )
    })

    return {
      id: order.id,
      phoneNumber: command.phoneNumber,
      updatedOrders,
      accountUpdated: command.updateAccount,
    }
  }
}
